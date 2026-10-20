# Murmuration

**Bluesky, live, on a spinning globe.**

Murmuration is a free, open-source screensaver that shows public [Bluesky](https://bsky.app) posts as they're written, all over the world. Each new post sends a ripple across a night-side Earth, and a few float up as cards you can read. A feed of recent posts runs down the left, and a ring around the globe shows which languages the world is posting in right now.

It's inspired by the 2007 [Twingly Screensaver](https://Labnol.org/internet/blogging/blogging-screensaver-visualize-blog-stories-twingly-globe/2880/), which did the same for blogs.

> **Status: early prototype.** The web version works in any modern browser, and the **Windows** and **macOS** screensavers build from source (see below). Ready-made downloads will be published on the [Releases page](https://github.com/charlie-f/Murmuration/releases).

---

## Try it

You need a modern browser (a recent Chrome, Edge, Firefox or Safari) and an internet connection. Nothing else needs to be installed.

1. Download this repository: click **Code → Download ZIP** above and unzip it, or run
   ```bash
   git clone https://github.com/charlie-f/Murmuration.git
   ```
2. Serve the `web` folder from a local web server. Browsers block some features (background workers, saved downloads) on pages opened straight from disk, so double-clicking `index.html` isn't enough. Any static server works; two common ones:
   ```bash
   python -m http.server 8000 --directory web
   ```
   ```bash
   npx serve web
   ```
3. Open the address it prints (for Python, <http://localhost:8000>) and press **F** for fullscreen.

### Windows screensaver (build from source)

Needs Windows 10 or 11 and [Visual Studio 2022](https://visualstudio.microsoft.com/) (the free Community edition is fine) with the **Desktop development with C++** workload.

1. Run `windows\build.bat`. The first build downloads Microsoft's WebView2 SDK once and checks it against a pinned hash.
2. Right-click `windows\build\Murmuration.scr` and choose **Install**. Windows opens Screen Saver Settings with Murmuration selected.

The same program also works as an app: double-click `windows\build\Murmuration.exe` to explore the globe in a window. Murmuration uses the Microsoft Edge WebView2 Runtime, which is built into Windows 11 and up-to-date Windows 10.

While the screensaver runs, move the mouse to show the **Explore** button. Press any key or click anywhere else to close it.

Murmuration keeps its files and settings in `%LOCALAPPDATA%\Murmuration`. Delete that folder to remove every trace, including the translation extra.

For development, `windows\build.bat dev` builds and opens the app reading `web\` live, with developer tools enabled.

### macOS screensaver and app (build from source)

Needs macOS 13 or later and Xcode (or just the Command Line Tools: `xcode-select --install`). Nothing else is downloaded.

1. Run `mac/build.sh`. It builds `mac/build/Murmuration.saver` and `mac/build/Murmuration.app`, for both Apple silicon and Intel Macs.
2. Double-click `Murmuration.saver` and choose to install it. It appears in **System Settings → Screen Saver**.
3. Drag `Murmuration.app` into **Applications**.

macOS closes a screensaver as soon as you touch the mouse or keyboard, so on a Mac the screensaver is for watching only, and exploring (spinning the globe, reading earlier posts, the Translation extra) happens in **Murmuration.app**. The screensaver's **Options…** button opens the app. To save power, only the main display runs the live globe; other displays show a still picture.

The translation extra lives in the app. The screensaver shows posts untranslated and keeps nothing on disk. To remove the app's saved settings and the translation extra, use **Uninstall** in its Translation panel, or delete the `com.github.charlie-f.Murmuration` folders in `~/Library/WebKit` and `~/Library/Caches`.

The build is signed only for the Mac it was built on. Copied to another Mac, it will get a Gatekeeper warning until there's a release signed with a paid Apple developer identity (set `MURMURATION_SIGN` to a signing identity to use one).

For development, `mac/build.sh dev` builds with the Web Inspector enabled and opens the app.

---

## Using it

Murmuration has two modes.

**Screensaver mode** (the default) is for watching. The globe turns on its own and posts flow in. Move the mouse and an **Explore** button appears for a few seconds (or press **E**).

**Interactive mode** lets you explore:

| To… | Do this |
|---|---|
| Spin the globe | Drag it |
| Zoom | Scroll wheel or pinch |
| Find a post on the globe | Click it in the feed on the left; the globe turns to it and marks it in pink |
| Let go of a selected post | Click it again, or press **Esc** |
| Read earlier posts | Scroll the feed (new posts wait while your pointer is over it) |
| Open a post on Bluesky | Click its card on the globe |
| Go back to watching | **Back to screensaver** (top right), or leave it alone for 2 minutes |

**Keys:** **Space** pause the spin · **F** fullscreen · **T** cards on the globe on/off · **L** translation on/off (once installed) · **Esc** close a panel or deselect.

**Colours:** amber means the location is guessed from the post's language, cyan means a country hint (see below), and pink is your selection.

---

## Where do the posts go on the map?

Bluesky posts don't carry a location, so Murmuration makes an honest guess and tells you how it guessed:

- **Cyan:** a real country hint, from the poster's handle domain (`.jp`, `.de`, `.co.uk`…; vanity domains like `.io` and `.tv` are ignored) or a regional language tag such as `en-GB`.
- **Amber:** a guess from the post's language. Japanese goes to Japan; English or Spanish is spread across the countries that speak it. The language is read from the post's tag and checked against the text itself, because the tag often reflects the poster's device rather than what they wrote.

Every card says which kind of guess placed it.

---

## Translation (optional extra)

Murmuration can translate posts into your language, right on your computer. It's **not installed by default**. To add it, open **Translation** in interactive mode. The panel lists exactly what will be downloaded before anything starts:

| Model | Size |
|---|---|
| Japanese | 115 MB |
| Portuguese, Spanish, French, Italian, Catalan | 119 MB |
| German | 112 MB |
| Korean | 120 MB |
| Chinese | 119 MB |
| All other languages (shared model, rougher) | 118 MB |
| Translation engine | 6 MB |
| **Total** | **about 709 MB** |

(If your own language isn't English, the list adjusts: your language's model is left out and an English-to-your-language model is added.)

- It uses the open-source [Opus-MT](https://github.com/Helsinki-NLP/Opus-MT) models from the University of Helsinki, run in the browser with [Transformers.js](https://github.com/huggingface/transformers.js). No account, no API key, and **post text never leaves your machine**.
- It runs on the CPU, so no special graphics card is needed. A post usually translates in under a second.
- Nothing else is downloaded later. Languages without their own model use the shared one.
- Hover over a translated post to see the original.
- **Uninstall** it from the same panel at any time to free the space. Murmuration keeps working without it.

Translation quality is good for most European languages, Chinese and Korean. Japanese is the weakest: it usually gets the gist but can miss parts of a post.

---

## What it shows, and what it doesn't

Murmuration runs unattended, so it leans toward caution:

- Only **top-level public posts** become cards (no replies).
- Before a post is shown, it's checked against Bluesky's public moderation labels. Anything labelled, on the post or the account, is skipped.
- Accounts that asked not to be shown to logged-out viewers are skipped.
- A post is checked 15 seconds after it's written, giving Bluesky's automatic labellers time to act first.
- A multilingual word filter (English, European languages, Russian, Japanese, Chinese, Korean) and a list of adult-site domains catch content that hasn't been labelled yet, in the text, in links and in link previews. It also checks translations. It errs on the side of hiding things.
- Nothing is stored: posts live in memory while they're on screen and then they're gone.

**Network connections it makes:**

| Address | Why |
|---|---|
| `jetstream*.bsky.network` | Bluesky's public live stream of posts |
| `public.api.bsky.app` | Checking moderation labels for posts about to be shown |
| `cdn.jsdelivr.net` | The translation engine, only when you install the extra |
| `huggingface.co` | Translation models, only when you install the extra |
| `bsky.app` | Only if you click a card to open a post |

There's no tracking, no analytics and no account.

---

## Project layout

```
web/                 The app, shared by every platform
  index.html         Page structure and security policy
  app.js             Globe, feed, modes, panels
  app.css            Styles
  translator.js      Translation worker (optional extra)
  translate-plan.js  What the translation extra installs
  vendor/            globe.gl and the Earth images, bundled (with their licenses)
windows/             Windows screensaver/app (C++ and WebView2); embeds web/ at build time
  build.bat          Builds build\Murmuration.scr
LICENSE              Apache License 2.0
NOTICE               Credits and third-party licenses
```

The Windows and macOS wrappers package the same `web/` files, so a change made once reaches every platform.

## Roadmap

- [x] Live globe, feed, language ring, post cards
- [x] Screensaver and interactive modes
- [x] Optional on-device translation
- [x] Windows screensaver (build from source)
- [ ] Windows release download (signed)
- [x] macOS screensaver and companion app (build from source; interactive mode is the app, since macOS closes screensavers on any input)
- [ ] macOS release download (signed and notarized)
- [x] Globe library and images bundled with the app

## Contributing

Bug reports and ideas are welcome in [Issues](https://github.com/charlie-f/Murmuration/issues). Pull requests too: please keep changes small and focused, and test them in at least one browser in both modes.

## License and credits

Murmuration is released under the [Apache License 2.0](LICENSE). It builds on [globe.gl](https://github.com/vasturiano/globe.gl), [Transformers.js](https://github.com/huggingface/transformers.js) and the [Opus-MT](https://github.com/Helsinki-NLP/Opus-MT) models; see [NOTICE](NOTICE) for full credits and their licenses.

Murmuration is not affiliated with or endorsed by Bluesky Social PBC. Post content belongs to its authors.
