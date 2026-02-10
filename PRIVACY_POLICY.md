# Privacy Policy for Aesthetic Sticky Notes

**Last updated:** [Add date, e.g. February 2025]

Aesthetic Sticky Notes ("the extension") is a Chrome extension that replaces your new tab with a sticky-notes page. This policy describes what data the extension uses and where it goes.

---

## Data stored on your device

The extension stores the following in your browser using Chrome’s storage (local and/or synced, depending on your Chrome sync settings):

- **Notes:** Note content, titles, tags, colors, size/position, and formatting. Used only to show and edit your notes on the new tab.
- **Settings:** Your chosen theme (dark/glass), optional name for the greeting, optional location for weather, search engine preference, and temperature unit. Used only to personalize the new-tab page.
- **Background:** The URL of the last loaded background image, so the next new tab can show it without an extra network request. Used only for display.

This data stays in your browser. We do not collect, upload, or have access to it on any server we control.

---

## Data sent to other services

The extension may send data to the following services only when you use the related feature:

| Feature | Data sent | Service | Purpose |
|--------|-----------|---------|---------|
| **Weather** | Location (city name or coordinates) you entered in Settings | Open-Meteo (geocoding-api.open-meteo.com, api.open-meteo.com) | To show current weather on the new-tab greeting line. Only used if you set a location. |
| **Background image** | None (only a request for “a random image”) | Developer’s proxy (Vercel), then Unsplash (images.unsplash.com) | To load a nature photo as the new-tab background. The proxy returns an image URL; the image is loaded from Unsplash. |
| **Ask AI** | The text you select in a note and your prompt | Developer’s proxy (Vercel), which forwards to an AI provider | To generate or refine text in your note. Used only when you click “Ask AI” and enter a prompt. |

The extension does not send your notes, name, or other stored data to these services except the text you explicitly select for “Ask AI.” The developer’s proxy (used for background images and AI) is operated by the extension developer; API keys are kept on that server and are not stored in the extension.

We do not sell, rent, or share your data with third parties for advertising or marketing.

---

## Data we do not collect

The extension does not collect or transmit:

- Analytics or usage tracking
- Browsing history or other tabs
- Personal data beyond what you optionally enter (name, location) for the greeting and weather

---

## Your choices and control

- **Notes and settings:** Stored only in your browser. You can remove them by clearing the extension’s storage or uninstalling the extension.
- **Weather:** Do not set a location in Settings if you do not want any location sent to Open-Meteo.
- **Background:** Triggered when you open a new tab or use the refresh control; you can avoid it by not using the new-tab override or the refresh button.
- **AI:** Used only when you click “Ask AI” and send a prompt; do not use that feature if you do not want text sent to the proxy/AI provider.

Uninstalling the extension removes its access to Chrome storage; any data in that storage may still remain until you clear it in Chrome.

---

## Changes to this policy

We may update this privacy policy from time to time. The “Last updated” date at the top will be revised when we do. Continued use of the extension after changes means you accept the updated policy.

---

## Contact

If you have questions about this privacy policy or the extension, you can contact the developer via the link provided in the extension (e.g. in the footer or on the Chrome Web Store listing).
