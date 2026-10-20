// Murmuration.saver: the globe as a look-only screensaver.
// Only the main display runs the web page; other displays and the little preview in
// System Settings draw a still picture, so there's one live stream at most.
// macOS closes screensavers on any input, so exploring happens in Murmuration.app.

import AppKit
import ScreenSaver
import WebKit

@objc(MurmurationSaverView)
final class MurmurationSaverView: ScreenSaverView {
    private var webView: WKWebView?
    private let delegate = WebViewDelegate()
    /// The one view running the page in this process. legacyScreenSaver makes several views,
    /// and on recent macOS the System Settings preview is full size and doesn't say it's a
    /// preview, so the newest view takes over and any older one stops.
    private static weak var live: MurmurationSaverView?
    private lazy var sheet = SettingsSheet()

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 3600  // nothing to animate natively; the page draws itself
        // legacyScreenSaver keeps running after the screensaver closes, and doesn't always
        // call stopAnimation: let go of the page when it's told the screensaver is stopping
        DistributedNotificationCenter.default().addObserver(
            self, selector: #selector(willStop), name: Notification.Name("com.apple.screensaver.willstop"), object: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    deinit { DistributedNotificationCenter.default().removeObserver(self) }

    private var isMainDisplay: Bool {
        guard !isPreview, let screen = window?.screen, let main = NSScreen.screens.first else { return false }
        return screen == main
    }

    override func startAnimation() {
        super.startAnimation()
        guard webView == nil, isMainDisplay,
              let web = Bundle(for: Self.self).resourceURL?.appendingPathComponent("web") else { return }
        Self.live?.tearDown()
        // Each display and the app keep separate storage anyway; the screensaver needs none
        let view = WebHost.makeWebView(webRoot: web, host: "screensaver", persistent: false, delegate: delegate)
        view.frame = bounds
        view.autoresizingMask = [.width, .height]
        addSubview(view)
        webView = view
        Self.live = self
    }

    override func stopAnimation() {
        super.stopAnimation()
        tearDown()
    }

    @objc private func willStop() { tearDown() }

    private func tearDown() {
        guard let view = webView else { return }
        view.stopLoading()
        view.configuration.userContentController.removeAllScriptMessageHandlers()
        view.removeFromSuperview()
        webView = nil
        needsDisplay = true
    }

    // Black, with a still globe in the preview and on other displays
    override func draw(_ rect: NSRect) {
        NSColor.black.setFill()
        bounds.fill()
        guard webView == nil, !isMainDisplay else { return }
        let size = min(bounds.width, bounds.height) * 0.6
        let c = NSPoint(x: bounds.midX, y: bounds.midY)
        let globe = NSBezierPath(ovalIn: NSRect(x: c.x - size / 2, y: c.y - size / 2, width: size, height: size))
        NSColor(srgbRed: 14 / 255, green: 34 / 255, blue: 66 / 255, alpha: 1).setFill()
        globe.fill()
        NSColor(srgbRed: 74 / 255, green: 134 / 255, blue: 216 / 255, alpha: 1).setStroke()
        globe.lineWidth = max(1, size / 60)
        globe.stroke()
        NSColor(srgbRed: 1, green: 180 / 255, blue: 84 / 255, alpha: 1).setFill()
        let dot = max(2, size / 40)
        for (dx, dy) in [(-12, 10), (-6, 14), (4, 6), (10, -4), (-2, -8), (14, 12)] as [(CGFloat, CGFloat)] {
            NSRect(x: c.x + dx * size / 60 - dot / 2, y: c.y + dy * size / 60 - dot / 2, width: dot, height: dot).fill()
        }
    }

    override var hasConfigureSheet: Bool { true }
    override var configureSheet: NSWindow? { sheet.window }
}

/// Options: what the screensaver does, and a way into the app (like the Windows settings dialog)
private final class SettingsSheet: NSObject {
    private static let appID = "com.github.charlie-f.Murmuration"

    lazy var window: NSWindow = {
        let w = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 420, height: 230), styleMask: [.titled], backing: .buffered, defer: true)
        let title = NSTextField(labelWithString: "Murmuration screensaver")
        title.font = .boldSystemFont(ofSize: 14)
        let body = NSTextField(wrappingLabelWithString:
            "Public Bluesky posts, live, on a spinning globe.\n\n" +
            "macOS closes a screensaver as soon as you touch the mouse or keyboard, so to spin the globe, " +
            "read earlier posts or set up translation, open the Murmuration app.")
        let version = Bundle(for: Self.self).object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let footer = NSTextField(labelWithString: "Version \(version) · free and open source (Apache-2.0)")
        footer.textColor = .secondaryLabelColor
        footer.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        let open = NSButton(title: "Open Murmuration", target: self, action: #selector(openApp))
        open.keyEquivalent = "\r"
        let page = NSButton(title: "Project Page", target: self, action: #selector(openProject))
        let close = NSButton(title: "Close", target: self, action: #selector(closeSheet))
        close.keyEquivalent = "\u{1b}"
        let buttons = NSStackView(views: [page, NSView(), close, open])
        buttons.distribution = .fill
        let stack = NSStackView(views: [title, body, footer, buttons])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        w.contentView = stack
        body.preferredMaxLayoutWidth = 380
        buttons.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -40).isActive = true
        return w
    }()

    @objc private func openApp() {
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: Self.appID) {
            NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
            closeSheet()
        } else {
            let alert = NSAlert()
            alert.messageText = "Murmuration.app isn't installed"
            alert.informativeText = "Put Murmuration.app in your Applications folder, or get it from the project page."
            alert.beginSheetModal(for: window)
        }
    }

    @objc private func openProject() { NSWorkspace.shared.open(URL(string: WebHost.repo)!) }

    @objc private func closeSheet() {
        if let parent = window.sheetParent { parent.endSheet(window) } else { window.orderOut(nil) }
    }
}
