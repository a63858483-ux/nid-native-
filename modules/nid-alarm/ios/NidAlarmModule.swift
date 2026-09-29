import AlarmKit
import ExpoModulesCore
import SwiftUI

struct NidAlarmMetadata: AlarmMetadata {}

// Real system alarms (iOS 26 AlarmKit): ring on the lock screen, through silent mode,
// with the system's own stop / snooze. JS decides when and what; this just schedules.
public class NidAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NidAlarm")

    AsyncFunction("authorize") { () async throws -> String in
      let manager = AlarmManager.shared
      switch manager.authorizationState {
      case .authorized: return "authorized"
      case .denied: return "denied"
      case .notDetermined:
        let state = try await manager.requestAuthorization()
        return state == .authorized ? "authorized" : "denied"
      @unknown default: return "unknown"
      }
    }

    // id: a UUID string chosen by JS so the same promise never schedules twice
    AsyncFunction("schedule") { (id: String, epochMs: Double, title: String) async throws -> String in
      guard let uuid = UUID(uuidString: id) else { throw NidAlarmError.badId }
      let date = Date(timeIntervalSince1970: epochMs / 1000)
      let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle")
      let snooze = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
      let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop, secondaryButton: snooze, secondaryButtonBehavior: .countdown)
      let attributes = AlarmAttributes<NidAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: NidAlarmMetadata(), tintColor: Color(red: 0.1, green: 0.51, blue: 0.99))
      let config = AlarmManager.AlarmConfiguration<NidAlarmMetadata>(
        countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: 9 * 60),
        schedule: .fixed(date),
        attributes: attributes
      )
      let alarm = try await AlarmManager.shared.schedule(id: uuid, configuration: config)
      return alarm.id.uuidString
    }

    AsyncFunction("cancel") { (id: String) throws in
      guard let uuid = UUID(uuidString: id) else { throw NidAlarmError.badId }
      try AlarmManager.shared.cancel(id: uuid)
    }

    AsyncFunction("list") { () throws -> [[String: Any]] in
      try AlarmManager.shared.alarms.map { alarm in
        var out: [String: Any] = ["id": alarm.id.uuidString, "state": Self.stateName(alarm.state)]
        if case .fixed(let date)? = alarm.schedule { out["at"] = date.timeIntervalSince1970 * 1000 }
        return out
      }
    }
  }

  static func stateName(_ s: Alarm.State) -> String {
    switch s {
    case .scheduled: return "scheduled"
    case .countdown: return "countdown"
    case .paused: return "paused"
    case .alerting: return "alerting"
    @unknown default: return "unknown"
    }
  }
}

enum NidAlarmError: Error {
  case badId
}
