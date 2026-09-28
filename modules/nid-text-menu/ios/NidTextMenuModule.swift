import ExpoModulesCore
import ObjectiveC
import UIKit

// Messages puts "Text Effects ›" after Cut / Copy / Paste when you select words.
// React Native's multiline input builds that menu in -buildMenuWithBuilder:, so we
// wrap that method once and add the submenu; picking an item tells JS which effect
// to wrap the selection in (the markers themselves live in JS).
public class NidTextMenuModule: Module {
  fileprivate static weak var current: NidTextMenuModule?

  public func definition() -> ModuleDefinition {
    Name("NidTextMenu")
    Events("onTextEffect")

    OnCreate {
      NidTextMenuModule.current = self
      DispatchQueue.main.async { TextEffectsMenu.install() }
    }
  }

  fileprivate func emit(_ kind: String, _ range: NSRange) {
    sendEvent("onTextEffect", ["kind": kind, "start": range.location, "end": range.location + range.length])
  }
}

private enum TextEffectsMenu {
  static var installed = false

  static let formats: [(String, String, String)] = [
    ("bold", "Bold", "bold"),
    ("italic", "Italic", "italic"),
    ("underline", "Underline", "underline"),
    ("strike", "Strikethrough", "strikethrough"),
  ]
  static let effects: [(String, String, String)] = [
    ("big", "Big", "textformat.size.larger"),
    ("small", "Small", "textformat.size.smaller"),
    ("shake", "Shake", "waveform.path"),
    ("nod", "Nod", "arrow.up.and.down"),
    ("explode", "Explode", "burst"),
    ("ripple", "Ripple", "water.waves"),
    ("bloom", "Bloom", "camera.macro"),
    ("jitter", "Jitter", "scribble.variable"),
  ]

  static func install() {
    let sel = #selector(UIResponder.buildMenu(with:))
    guard !installed, let cls = NSClassFromString("RCTUITextView"), let method = class_getInstanceMethod(cls, sel) else { return }
    installed = true
    typealias Original = @convention(c) (AnyObject, Selector, UIMenuBuilder) -> Void
    let original = unsafeBitCast(method_getImplementation(method), to: Original.self)
    let block: @convention(block) (AnyObject, UIMenuBuilder) -> Void = { obj, builder in
      original(obj, sel, builder)
      guard let tv = obj as? UITextView, tv.isEditable, tv.selectedRange.length > 0 else { return }
      builder.insertChild(menu(for: tv), atEndOfMenu: .standardEdit)
    }
    method_setImplementation(method, imp_implementationWithBlock(block))
  }

  static func menu(for tv: UITextView) -> UIMenu {
    func actions(_ list: [(String, String, String)]) -> [UIAction] {
      list.map { item in
        let (kind, title, symbol) = item
        return UIAction(title: title, image: UIImage(systemName: symbol)) { [weak tv] _ in
          guard let tv else { return }
          NidTextMenuModule.current?.emit(kind, tv.selectedRange)
        }
      }
    }
    return UIMenu(
      title: "Text Effects",
      identifier: UIMenu.Identifier("top.xiaoketata.nid.textEffects"),
      children: [
        UIMenu(title: "", options: .displayInline, children: actions(formats)),
        UIMenu(title: "", options: .displayInline, children: actions(effects)),
      ]
    )
  }
}
