import ExpoModulesCore
import PDFKit
import UIKit

// PDFKit reader for the study room: one page at a time, swipe to turn, the system's own
// selection. Highlights come from the server (quote + page) and are drawn as PDF annotations;
// tapping one tells JS which, so JS can open its note thread.
public class NidPdfModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NidPdf")

    View(NidPdfView.self) {
      Events("onPageChanged", "onSelection", "onTapMark", "onTap", "onLoad")

      Prop("path") { (view: NidPdfView, path: String) in view.load(path) }
      Prop("initialPage") { (view: NidPdfView, page: Int) in view.initialPage = page }
      Prop("paper") { (view: NidPdfView, hex: String) in view.setPaper(hex) }
      Prop("marks") { (view: NidPdfView, marks: [[String: Any]]) in view.setMarks(marks) }

      AsyncFunction("highlightSelection") { (view: NidPdfView) -> [String: Any]? in view.takeSelection() }.runOnQueue(.main)
      AsyncFunction("clearSelection") { (view: NidPdfView) in view.pdf.clearSelection() }.runOnQueue(.main)
      AsyncFunction("goToPage") { (view: NidPdfView, page: Int) in view.goTo(page) }.runOnQueue(.main)
      AsyncFunction("search") { (view: NidPdfView, q: String) -> [[String: Any]] in view.search(q) }.runOnQueue(.main)
      AsyncFunction("goToResult") { (view: NidPdfView, index: Int) in view.goToResult(index) }.runOnQueue(.main)
      AsyncFunction("outline") { (view: NidPdfView) -> [[String: Any]] in view.outline() }.runOnQueue(.main)
    }
  }
}

public class NidPdfView: ExpoView {
  let pdf = PDFView()
  let onPageChanged = EventDispatcher()
  let onSelection = EventDispatcher()
  let onTapMark = EventDispatcher()
  let onTap = EventDispatcher()
  let onLoad = EventDispatcher()
  var initialPage = 1
  private var loadedPath = ""
  private var drawn: [PDFAnnotation] = []
  private var pendingMarks: [[String: Any]] = []
  private var results: [PDFSelection] = []
  private var lastSelection = ""

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    pdf.displayMode = .singlePage
    pdf.displayDirection = .horizontal
    pdf.autoScales = true
    pdf.usePageViewController(true, withViewOptions: [UIPageViewController.OptionsKey.interPageSpacing: 12])
    pdf.pageShadowsEnabled = false
    addSubview(pdf)
    NotificationCenter.default.addObserver(self, selector: #selector(pageChanged), name: .PDFViewPageChanged, object: pdf)
    NotificationCenter.default.addObserver(self, selector: #selector(selectionChanged), name: .PDFViewSelectionChanged, object: pdf)
    let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
    tap.cancelsTouchesInView = false
    tap.delegate = self
    pdf.addGestureRecognizer(tap)
  }

  deinit { NotificationCenter.default.removeObserver(self) }

  public override func layoutSubviews() {
    super.layoutSubviews()
    pdf.frame = bounds
  }

  func load(_ path: String) {
    guard path != loadedPath else { return }
    loadedPath = path
    let url: URL? = path.hasPrefix("file://") ? URL(string: path) : URL(fileURLWithPath: path)
    guard let url, let doc = PDFDocument(url: url) else {
      onLoad(["ok": false])
      return
    }
    pdf.document = doc
    if pendingMarks.count > 0 { setMarks(pendingMarks) }
    DispatchQueue.main.async {
      self.goTo(self.initialPage)
      self.onLoad(["ok": true, "pages": doc.pageCount])
      self.pageChanged()
    }
  }

  func setPaper(_ hex: String) {
    var v: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    let c = UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 1)
    pdf.backgroundColor = c
    backgroundColor = c
  }

  func goTo(_ page: Int) {
    guard let doc = pdf.document, doc.pageCount > 0 else { return }
    let i = max(0, min(doc.pageCount - 1, page - 1))
    if let p = doc.page(at: i) { pdf.go(to: p) }
  }

  @objc func pageChanged() {
    guard let doc = pdf.document, let p = pdf.currentPage else { return }
    onPageChanged(["page": doc.index(for: p) + 1, "total": doc.pageCount])
  }

  @objc func selectionChanged() {
    let s = pdf.currentSelection?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard s != lastSelection else { return }
    lastSelection = s
    var page = 0
    if let doc = pdf.document, let p = pdf.currentSelection?.pages.first { page = doc.index(for: p) + 1 }
    onSelection(["text": s, "page": page])
  }

  @objc func tapped(_ g: UITapGestureRecognizer) {
    let pt = g.location(in: pdf)
    if let page = pdf.page(for: pt, nearest: true) {
      let local = pdf.convert(pt, to: page)
      if let a = page.annotation(at: local), let name = a.userName, name.hasPrefix("nid:"), let id = Int(name.dropFirst(4)) {
        onTapMark(["id": id])
        return
      }
    }
    if (pdf.currentSelection?.string ?? "").isEmpty { onTap([:]) }
  }

  // marks: [{ id, quote, page, color }]
  func setMarks(_ marks: [[String: Any]]) {
    pendingMarks = marks
    guard let doc = pdf.document else { return }
    for a in drawn { a.page?.removeAnnotation(a) }
    drawn.removeAll()
    for m in marks {
      guard let id = m["id"] as? Int, let quote = m["quote"] as? String, !quote.isEmpty else { continue }
      let want = (m["page"] as? Int) ?? 0
      let color = colorOf(m["color"] as? String)
      let hits = doc.findString(String(quote.prefix(200)), withOptions: [.caseInsensitive])
      guard let sel = hits.first(where: { s in want == 0 || s.pages.contains { doc.index(for: $0) + 1 == want } }) ?? hits.first else { continue }
      draw(sel, id: id, color: color)
    }
  }

  private func colorOf(_ hex: String?) -> UIColor {
    guard let hex, hex.count >= 7 else { return UIColor(red: 1, green: 0.85, blue: 0.3, alpha: 0.5) }
    var v: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 0.5)
  }

  private func draw(_ sel: PDFSelection, id: Int, color: UIColor) {
    for line in sel.selectionsByLine() {
      for page in line.pages {
        let a = PDFAnnotation(bounds: line.bounds(for: page), forType: .highlight, withProperties: nil)
        a.color = color
        a.userName = "nid:\(id)"
        page.addAnnotation(a)
        drawn.append(a)
      }
    }
  }

  // The current selection as { quote, page }; JS saves it and sends marks back with its id.
  func takeSelection() -> [String: Any]? {
    guard let sel = pdf.currentSelection, let text = sel.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty, let doc = pdf.document else { return nil }
    let page = sel.pages.first.map { doc.index(for: $0) + 1 } ?? 0
    pdf.clearSelection()
    return ["quote": text, "page": page]
  }

  func search(_ q: String) -> [[String: Any]] {
    guard let doc = pdf.document, !q.isEmpty else { return [] }
    results = Array(doc.findString(q, withOptions: [.caseInsensitive]).prefix(200))
    return results.enumerated().map { i, s in
      let ctx = s.copy() as! PDFSelection
      ctx.extend(atStart: 18)
      ctx.extend(atEnd: 30)
      let page = s.pages.first.map { doc.index(for: $0) + 1 } ?? 0
      let text = (ctx.string ?? q).replacingOccurrences(of: "\n", with: " ")
      return ["index": i, "page": page, "text": text]
    }
  }

  func goToResult(_ i: Int) {
    guard i >= 0, i < results.count else { return }
    pdf.go(to: results[i])
    pdf.setCurrentSelection(results[i], animate: true)
  }

  func outline() -> [[String: Any]] {
    guard let doc = pdf.document, let root = doc.outlineRoot else { return [] }
    var out: [[String: Any]] = []
    func walk(_ node: PDFOutline, _ level: Int) {
      for i in 0..<node.numberOfChildren {
        guard let c = node.child(at: i) else { continue }
        let page = c.destination?.page.map { doc.index(for: $0) + 1 } ?? 0
        out.append(["title": c.label ?? "", "page": page, "level": level])
        if level < 2 { walk(c, level + 1) }
      }
    }
    walk(root, 0)
    return out
  }
}

extension NidPdfView: UIGestureRecognizerDelegate {
  public func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}
