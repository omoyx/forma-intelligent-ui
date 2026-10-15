# Forma · Intelligent UI

A concise Chinese chat demo built with the official OpenUI SDK. Text and interactive cards render as the model streams them.

Live demo: https://omoyx.github.io/forma-intelligent-ui/

The website requires an access password. Authentication and model credentials remain on a separate server; no model API key or access password is included in this repository.

## Development

Node.js 22+, `npm ci`, `npm run build`, `npm start`.

The server reads `HUOSHAN_BASE_URL` and `HUOSHAN_API_KEY` from the environment. Production also uses `DEMO_PASSWORD_HASH` (salt:scrypt-32-byte-hex), `DEMO_ALLOWED_ORIGIN`, and `PORT`. Frontend builds accept `INTELLIGENT_UI_API_BASE`; an empty value uses the current origin.

`docs/` contains the published GitHub Pages build. Keep credentials outside this repository. Dependencies are pinned to verified npmmirror package URLs.

## Real images

`PhotoCard(query, caption)` and `PhotoGallery([namedCards])` retrieve reference images from Wikimedia Commons. The model supplies search keywords, not URLs. Cards load independently in the conversation and retain source, author and license, with retry and alternate-image controls. Try “给我 C 型和 F 型欧标插头的真实照片，简单说区别” or “水豚长什么样，给我一张真实照片”.

The password-protected `/api/images` endpoint uses a fixed provider, trusted HTTPS image hosts, a 12-second timeout, bounded concurrency and a one-hour cache. Images load directly from Wikimedia; only search keywords go to Commons. Search results are visual references and are not semantically inspected by the model.
