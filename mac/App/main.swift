// Murmuration.app: the globe in a normal window, starting in interactive mode.

import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow!
    private let delegate = WebViewDelegate()

    func applicationDidFinishLaunching(_ note: Notification) {
        NSApp.mainMenu = makeMenu()

        // A comfortable window on the main display
        let visible = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let size = NSSize(width: visible.width * 0.8, height: visible.height * 0.8)
        window = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Murmuration"
        window.backgroundColor = .black
        window.contentMinSize = NSSize(width: 720, height: 480)
        window.collectionBehavior = .fullScreenPrimary
        window.isReleasedWhenClosed = false
        window.center()
        window.setFrameAutosaveName("Murmuration")

        let web = Bundle.main.resourceURL!.appendingPathComponent("web")
        delegate.onExit = { NSApp.terminate(nil) }
        window.contentView = WebHost.makeWebView(webRoot: web, host: "app", persistent: true, delegate: delegate)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    private func makeMenu() -> NSMenu {
        let main = NSMenu()
        func submenu(_ title: String, _ items: [NSMenuItem]) {
            let menu = NSMenu(title: title)
            items.forEach(menu.addItem)
            let holder = NSMenuItem()
            holder.submenu = menu
            main.addItem(holder)
        }
        func item(_ title: String, _ action: Selector, _ key: String, _ mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
            i.keyEquivalentModifierMask = mods
            return i
        }
        submenu("Murmuration", [
            item("About Murmuration", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""),
            .separator(),
            item("Hide Murmuration", #selector(NSApplication.hide(_:)), "h"),
            item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            item("Show All", #selector(NSApplication.unhideAllApplications(_:)), ""),
            .separator(),
            item("Quit Murmuration", #selector(NSApplication.terminate(_:)), "q"),
        ])
        submenu("Edit", [
            item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Select All", #selector(NSText.selectAll(_:)), "a"),
        ])
        submenu("View", [
            item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ])
        let windowItems = [
            item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Zoom", #selector(NSWindow.performZoom(_:)), ""),
            item("Close", #selector(NSWindow.performClose(_:)), "w"),
        ]
        submenu("Window", windowItems)
        NSApp.windowsMenu = main.items.last?.submenu
        return main
    }
}

let app = NSApplication.shared
let appDelegate = AppDelegate()
app.delegate = appDelegate
app.setActivationPolicy(.regular)
app.run()
