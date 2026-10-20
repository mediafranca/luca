import AppKit
import WebKit

// Pure AppKit — builds with Command Line Tools alone (no Xcode / SwiftUI macros).

final class AppDelegate: NSObject, NSApplicationDelegate, NSTextViewDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var textView: NSTextView!
    var web: WKWebView!
    var ready = false
    var pending: String?

    func applicationDidFinishLaunching(_: Notification) {
        // Editor
        let scroll = NSTextView.scrollableTextView()
        textView = (scroll.documentView as! NSTextView)
        textView.isRichText = false
        textView.font = .monospacedSystemFont(ofSize: 14, weight: .regular)
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.textContainerInset = NSSize(width: 8, height: 8)
        textView.delegate = self
        textView.string = sampleDoc

        // Preview
        web = WKWebView()
        web.setValue(false, forKey: "drawsBackground")
        web.navigationDelegate = self
        web.loadHTMLString(template, baseURL: URL(string: "https://luca.local/"))

        // Split
        let split = NSSplitView()
        split.isVertical = true
        split.dividerStyle = .thin
        split.addArrangedSubview(scroll)
        split.addArrangedSubview(web)

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 560),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        window.titlebarAppearsTransparent = true
        window.title = "luca"
        window.contentView = split
        window.center()
        window.makeKeyAndOrderFront(nil)
        split.setPosition(430, ofDividerAt: 0)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_: NSApplication) -> Bool { true }

    func textDidChange(_: Notification) { render(textView.string) }

    func webView(_: WKWebView, didFinish _: WKNavigation!) {
        ready = true
        render(pending ?? textView.string)
    }

    func render(_ md: String) {
        guard ready else { pending = md; return }
        let json = (try? JSONEncoder().encode(md)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
        web.evaluateJavaScript("window.renderMarkdown(\(json))")
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()

// ponytail: marked + mermaid from CDN — needs network. Vendor the two .js files
// into the bundle when offline rendering matters.
let template = """
<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.6 -apple-system, system-ui, sans-serif; margin: 0; padding: 20px 28px; }
  pre, code { font-family: ui-monospace, Menlo, monospace; }
  pre:not(.mermaid) { background: rgba(127,127,127,.12); padding: 12px; border-radius: 8px; overflow-x: auto; }
  pre.mermaid { background: transparent; text-align: center; }
  img { max-width: 100%; }
  blockquote { border-left: 3px solid rgba(127,127,127,.4); margin: 0; padding-left: 1em; opacity: .85; }
  table { border-collapse: collapse; } td, th { border: 1px solid rgba(127,127,127,.3); padding: 4px 8px; }
</style>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
</head><body><div id="out"></div>
<script>
  mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
  marked.use({ renderer: { code(code, lang) {
    return lang === 'mermaid' ? '<pre class="mermaid">' + code + '</pre>'
                              : '<pre><code>' + code.replace(/</g,'&lt;') + '</code></pre>';
  }}});
  window.renderMarkdown = function (md) {
    document.getElementById('out').innerHTML = marked.parse(md);
    const blocks = document.querySelectorAll('pre.mermaid');
    if (blocks.length) { blocks.forEach(b => b.removeAttribute('data-processed')); mermaid.run({ nodes: blocks }); }
  };
</script></body></html>
"""

let sampleDoc = """
# luca

Editor Markdown mínimo y rápido.

- escribe a la izquierda
- mira a la derecha

```mermaid
flowchart LR
  escribir --> ver --> pensar --> escribir
```
"""
