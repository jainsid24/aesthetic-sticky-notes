# Pre-release checklist

## Security (done in code)
- [x] No API keys in extension; proxy holds keys on Vercel
- [x] No sensitive data in console/logs
- [x] CSP and host_permissions limited to needed origins
- [x] User content escaped (escapeHtml) for title, content, tags
- [x] Persisted data sanitized for inline CSS (safeCssColor, safePriority, width/height)

## Before publishing
- [ ] Set `PROXY_BASE_URL` in script.js to your production Vercel URL
- [ ] Ensure Vercel env vars (OPENROUTER_API_KEY, UNSPLASH_ACCESS_KEY) are set and redeployed
- [ ] Test: new tab, background, AI write, notes, settings
- [ ] Bump version in manifest.json if needed (e.g. 1.0.0 → 1.0.1 for fixes)
- [ ] Optional: add a privacy policy URL in Chrome Web Store listing (what data is stored: notes in sync/local, name/location in sync, no keys)

## Chrome Web Store
- [ ] Pack extension (zip or use “Pack extension” in chrome://extensions)
- [ ] Developer dashboard: upload, fill listing (description, screenshots, privacy practices)
- [ ] Submit for review
