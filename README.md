# Aesthetic Sticky Notes

**Your new tab, reimagined.** A calm, focused space to capture notes—with AI help and nature backgrounds.

---

## Why this?

Open a new tab and land in a clean sticky-notes page instead of a blank screen or a feed. Write, tag, and organize from one place. Optional AI helps you expand or refine text. Gentle nature backgrounds and themes keep it easy on the eyes.

- **Notes that stick** — Create as many notes as you need. Pin, tag, color, and search. Everything saves automatically.
- **AI when you want it** — Select text and ask AI to expand, shorten, or rephrase. One click, no app switching.
- **Calm by default** — Daily nature backgrounds, dark and glass themes, optional weather. Your tab stays useful, not noisy.
- **Yours only** — Notes and settings live in your browser. No account required to use it.

---

## Get it

**[Install from the Chrome Web Store](https://chrome.google.com/webstore)** *(add your store link once live)*

Or load the extension manually: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select this folder.

---

## What you can do

| | |
|---|---|
| **Notes** | Title, content, tags, colors, pin to top, priority. Bold, italic, code, lists, checkboxes. |
| **Find** | Search by title, content, or tags. |
| **Themes** | Dark and glass. White greeting and controls so they stay readable on any background. |
| **Background** | New nature image when you click refresh (no network calls on tab load). |
| **Weather** | Optional. Set a location in Settings to show weather in the greeting line. |
| **Shortcuts** | `Ctrl/Cmd + N` — new note. |

---

## AI / proxy (Vercel)

The AI and background image features call a small proxy you host on Vercel (see `api/`). **Turn off Deployment Protection** for that project so the extension works in every Chrome profile: Vercel → your project → **Settings** → **Deployment Protection** → set to **Disabled** (or “Only Preview Deployments”). If protection is on, only profiles that have logged in to the deployment in a browser tab will get 200; others get 401 before your API runs.

---

## Privacy

Notes and settings are stored in your browser. The extension does not collect or sell your data. Optional features (weather, background images, AI) use the services described in the [Privacy Policy](PRIVACY_POLICY.md).

---

## Support

Found a bug or have an idea? Open an issue or get in touch via the link on the Chrome Web Store listing.

---

*Made with care for a calmer new tab.*
