import Combine
import ExpoModulesCore
import MusicKit

// Apple Music through MusicKit. Kept deliberately thin so the rest lives in JS (and can
// change over the air): authorize, a raw Apple Music API call (MusicDataRequest adds the
// developer and user tokens itself), play things in the Music app's player, report its state.
public class NidMusicModule: Module {
  private var bag = Set<AnyCancellable>()
  private var lastEntryId: String?

  public func definition() -> ModuleDefinition {
    Name("NidMusic")
    Events("onChange")

    OnStartObserving {
      let player = SystemMusicPlayer.shared
      player.state.objectWillChange
        .merge(with: player.queue.objectWillChange)
        .debounce(for: .milliseconds(250), scheduler: DispatchQueue.main)
        .sink { [weak self] _ in self?.emitChange() }
        .store(in: &self.bag)
    }
    OnStopObserving {
      self.bag.removeAll()
    }

    AsyncFunction("authorize") { () async -> String in
      let status = await MusicAuthorization.request()
      return Self.name(status)
    }

    Function("authorizationStatus") { () -> String in
      Self.name(MusicAuthorization.currentStatus)
    }

    // path like "/v1/me/recent/played/tracks?limit=20"; returns the response body as a string
    AsyncFunction("api") { (path: String) async throws -> String in
      guard let url = URL(string: "https://api.music.apple.com" + path) else { throw NidMusicError.badPath }
      let response = try await MusicDataRequest(urlRequest: URLRequest(url: url)).response()
      return String(data: response.data, encoding: .utf8) ?? ""
    }

    // kind: "songs" (ids = catalog song ids), "playlist", "album"; library = ids are library ids
    AsyncFunction("play") { (kind: String, ids: [String], library: Bool, start: Int) async throws in
      let player = SystemMusicPlayer.shared
      let itemIds = ids.map { MusicItemID($0) }
      switch (kind, library) {
      case ("songs", false):
        var req = MusicCatalogResourceRequest<Song>(matching: \.id, memberOf: itemIds)
        req.limit = 100
        let songs = try await req.response().items
        let ordered = itemIds.compactMap { id in songs.first { $0.id == id } }
        guard !ordered.isEmpty else { throw NidMusicError.notFound }
        player.queue = SystemMusicPlayer.Queue(for: ordered, startingAt: ordered[min(max(start, 0), ordered.count - 1)])
      case ("songs", true):
        var req = MusicLibraryRequest<Song>()
        req.filter(matching: \.id, memberOf: itemIds)
        let songs = try await req.response().items
        let ordered = itemIds.compactMap { id in songs.first { $0.id == id } }
        guard !ordered.isEmpty else { throw NidMusicError.notFound }
        player.queue = SystemMusicPlayer.Queue(for: ordered, startingAt: ordered[min(max(start, 0), ordered.count - 1)])
      case ("playlist", false):
        let found = try await MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: itemIds[0]).response().items
        guard let p = found.first else { throw NidMusicError.notFound }
        player.queue = [p]
      case ("playlist", true):
        var req = MusicLibraryRequest<Playlist>()
        req.filter(matching: \.id, equalTo: itemIds[0])
        guard let p = try await req.response().items.first else { throw NidMusicError.notFound }
        player.queue = [p]
      case ("album", false):
        let found = try await MusicCatalogResourceRequest<Album>(matching: \.id, equalTo: itemIds[0]).response().items
        guard let a = found.first else { throw NidMusicError.notFound }
        player.queue = [a]
      case ("album", true):
        var req = MusicLibraryRequest<Album>()
        req.filter(matching: \.id, equalTo: itemIds[0])
        guard let a = try await req.response().items.first else { throw NidMusicError.notFound }
        player.queue = [a]
      default:
        throw NidMusicError.badKind
      }
      try await player.play()
    }

    AsyncFunction("resume") { () async throws in try await SystemMusicPlayer.shared.play() }
    Function("pause") { SystemMusicPlayer.shared.pause() }
    AsyncFunction("next") { () async throws in try await SystemMusicPlayer.shared.skipToNextEntry() }
    AsyncFunction("previous") { () async throws in try await SystemMusicPlayer.shared.skipToPreviousEntry() }
    Function("seek") { (seconds: Double) in SystemMusicPlayer.shared.playbackTime = seconds }

    Function("state") { () -> [String: Any] in
      Self.snapshot()
    }
  }

  private func emitChange() {
    let snap = Self.snapshot()
    sendEvent("onChange", snap)
    lastEntryId = (snap["item"] as? [String: Any])?["id"] as? String
  }

  static func snapshot() -> [String: Any] {
    let player = SystemMusicPlayer.shared
    var out: [String: Any] = [
      "playing": player.state.playbackStatus == .playing,
      "time": player.playbackTime,
    ]
    if let entry = player.queue.currentEntry {
      var item: [String: Any] = ["id": entry.id, "title": entry.title]
      if let sub = entry.subtitle { item["artist"] = sub }
      if let art = entry.artwork?.url(width: 600, height: 600) { item["artwork"] = art.absoluteString }
      if let bg = entry.artwork?.backgroundColor { item["color"] = bg.hexString }
      if let current = entry.item {
        switch current {
        case .song(let s):
          item["songId"] = s.id.rawValue
          item["album"] = s.albumTitle ?? ""
          item["artist"] = s.artistName
          if let d = s.duration { item["duration"] = d }
        case .musicVideo(let v):
          item["artist"] = v.artistName
          if let d = v.duration { item["duration"] = d }
        @unknown default:
          break
        }
      }
      out["item"] = item
    }
    return out
  }

  static func name(_ s: MusicAuthorization.Status) -> String {
    switch s {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
  }
}

enum NidMusicError: Error {
  case badPath, badKind, notFound
}

private extension CGColor {
  var hexString: String {
    guard let c = converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components, c.count >= 3 else { return "" }
    return String(format: "#%02X%02X%02X", Int(c[0] * 255), Int(c[1] * 255), Int(c[2] * 255))
  }
}
