// Murmuration for macOS: the part shared by the app and the screensaver.
// Serves the bundled web/ folder on murmuration://app/ and keeps the page in its lane:
// it stays on its own origin, opens only a few known links in the viewer's browser,
// and can ask the host to close.

import AppKit
import WebKit

enum WebHost {
    static let scheme = "murmuration"
    static let origin = "murmuration://app/"
    static let repo = "https://github.com/charlie-f/Murmuration"
    static let appID = "com.github.charlie-f.Murmuration"

    /// A web view showing index.html?host=<host> from `webRoot` (the bundled web/ folder),
    /// with any extra `query` (already URL-safe) after it.
    /// `persistent` gives the page lasting storage (settings, the translation extra);
    /// without it nothing is written to disk.
    static func makeWebView(webRoot: URL, host: String, query: String = "", persistent: Bool,
                            delegate: WebViewDelegate) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(root: webRoot), forURLScheme: scheme)
        config.websiteDataStore = persistent ? .default() : .nonPersistent()
        config.userContentController.add(WeakMessageHandler(delegate), name: "murmuration")
        if #available(macOS 12.3, *) { config.preferences.isElementFullscreenEnabled = true }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = delegate
        webView.uiDelegate = delegate
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsMagnification = false
        webView.allowsLinkPreview = false  // a force click would otherwise preview a link in a new web view
        webView.underPageBackgroundColor = .black
        #if DEV
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        #endif
        webView.load(URLRequest(url: URL(string: "\(origin)index.html?host=\(host)\(query.isEmpty ? "" : "&" + query)")!))
        return webView
    }
}

/// Navigation, links and messages from the page. The host decides what "exit" means.
final class WebViewDelegate: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    /// Pages the app may open in the viewer's browser; anything else is ignored
    private let externalAllowed = ["https://bsky.app/", WebHost.repo + "/"]
    var onExit: () -> Void = {}

    // Stay on our own pages. A link that asks for a new window (target="_blank") arrives here
    // with no target frame, and opens in the viewer's browser if it's allowed.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = action.request.url
        if action.targetFrame == nil {
            openExternal(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(url?.absoluteString.hasPrefix(WebHost.origin) == true ? .allow : .cancel)
    }

    // window.open (a post on Bluesky) also opens in the viewer's browser; never a new web view
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        openExternal(action.request.url)
        return nil
    }

    private func openExternal(_ url: URL?) {
        guard let url else { return }
        let s = url.absoluteString
        if s == WebHost.repo || externalAllowed.contains(where: { s.hasPrefix($0) }) {
            NSWorkspace.shared.open(url)
        }
    }

    // Runs unattended: if the page's process dies, start it again
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // The page asks to close (it only ever sends "exit")
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.body as? String == "exit" { onExit() }
    }
}

/// WKUserContentController holds its handlers strongly; this keeps it from holding the delegate.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

/// Answers murmuration://app/<path> from files under `root`, and nothing outside it
/// (paths are compared after resolving "..", percent-encoding and symlinks).
private final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    private static let types = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8", "json": "application/json",
        "png": "image/png", "jpg": "image/jpeg", "svg": "image/svg+xml", "txt": "text/plain; charset=utf-8",
    ]

    init(root: URL) { self.root = root.standardizedFileURL.resolvingSymlinksInPath() }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let file = root.appendingPathComponent(url.path).standardizedFileURL.resolvingSymlinksInPath()
        let inside = file.path.hasPrefix(root.path + "/")
        let type = Self.types[file.pathExtension.lowercased()]
        guard url.host == "app", inside, let type, let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: [:])!)
            task.didFinish()
            return
        }
        let headers = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}  // answers are immediate
}
