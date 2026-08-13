# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Vite dev server (port 3000)
npm run build         # Production build (tsc && vite build)
npm run preview       # Preview production build
npm test              # Run unit tests once (Vitest, Node env)
npm run test:watch    # Vitest watch mode
npm run lint          # ESLint 9 (flat config)
npm run tauri:dev     # Tauri desktop dev (Rust required)
npm run tauri:build   # Tauri desktop build (Tauri 1.x, NOT 2.x)
npm run deploy        # Build + deploy to GitHub Pages (gh-pages -d dist)
```

Note: the machine-level npm cache may be root-owned (EPERM bug). If `npm ci` fails,
use `npm ci --cache "$PWD/.npm-cache"`.

## Architecture

Browser-based P2P messenger. React 18 + TypeScript + Vite, Redux Toolkit,
Radix UI + Tailwind CSS. Optional Tauri 1.x desktop shell (`src-tauri/`).

**Core flow:** Peer A starts a session → gets a unique PeerJS ID → shares it →
Peer B connects by ID → data channel opens → RSA key exchange → AES-256-GCM
encrypted chat, images and file chunks flow over WebRTC.

### Key Layers

**`src/helpers/peer.ts`** — The P2P engine. Wraps PeerJS with a singleton
`PeerConnection` object that owns:
- `connectionMap: Map<string, DataConnection>` — all active connections
- `peerMetadataMap` — per-peer connection metadata (public keys/fingerprints)
- Per-peer data buffering so early messages (KEY_EXCHANGE) are never lost
- Promise-based API for session lifecycle and `connectPeer(id, metadata)`

**`src/services/encryptionService.ts`** — `EncryptionManager` singleton. Owns
the RSA-2048 key pair, per-peer AES-256-GCM session keys, fingerprints, and
verification state. Redux thunks and React hooks share this one instance.
Wire format: ciphertext is base64 in `Data.payload` + `Data.iv` with
`Data.encrypted: true`.

**`src/services/cryptoService.ts`** — Pure Web Crypto primitives (RSA-OAEP,
AES-GCM, fingerprint, base64 helpers).

**`src/store/connection/receiveData.ts`** — The SINGLE incoming-data pipeline
(do not duplicate it). Serial per-peer queue (decryption is async), key
exchange, chat/typing, and the file protocol.

**`src/store/file/transferCoordinator.ts`** — Module-level transfer protocol
state (incoming chunk buffers, sender accept-waiters, cancel flags). Kept out
of Redux because it holds live Blobs/ciphertext.

**File transfer protocol** (all control messages are `DataType.FILE` with a
`message` field):
1. `FILE_START` (metadata + `messageType: 'file' | 'image'`; encrypted when a
   session key exists)
2. `FILE_ACCEPT` / `FILE_REJECT` — receiver confirmation (>5MB requires
   explicit accept; smaller files auto-accept)
3. `FILE_CHUNK` × N (encrypted when a session key exists)
4. `FILE_END` → receiver checks completeness → `FILE_COMPLETE` or
   `FILE_MISSING` (chunk indexes); sender retransmits up to 5 rounds
5. `FILE_CANCEL` — either side aborts

**Receipts**: receivers send `RECEIPT` (`delivered`/`read`) over the encrypted
OTHER channel; `selectConnection` sends catch-up read receipts.

**`src/store/`** — Redux Toolkit store with slices: `peer`, `connection`,
`connectionRequest`, `chat`, `file`, `settings`. Thunks are hand-written and
call `PeerConnection` / `encryptionManager` directly.

**`src/App.tsx`** — Single-page UI: header (session controls/settings),
sidebar (connection list + new-connection form), chat view, connection
request dialog.

### Important Patterns

- **Encryption setting** gates only outgoing encryption; receivers decrypt
  whenever a session key exists. Key exchange happens at connection time via
  metadata + KEY_EXCHANGE (initiator side generates the session key).
- **Images** must go through the chunked file protocol (single-message
  base64 breaks the ~64KB WebRTC message limit). `ImageService.compressImage`
  runs before sending.
- **Cancel** is cooperative: the send loop checks
  `isTransferCancelled(transferId)` at each chunk boundary.
- **Connection history** lives in the `connection` slice (`history: string[]`)
  and persists to localStorage key `p2p-messenger-connections`.
- **Notifications** fire only when `notificationsEnabled` and the document is
  hidden; permission is requested when the setting is enabled.
- **Toast feedback** goes through the `toast()` bus in
  `src/services/toastService.ts`; the App renders the Radix viewport. Use it
  for errors/confirmations instead of adding new UI.
- **File size limit** (`settings.maxFileSize`) is enforced in
  `useFileTransfer.sendFile`; oversized files throw and surface as a toast.
- **Radix UI + Tailwind**, no Ant Design. Theme tokens are CSS variables in
  `src/styles/globals.css`; i18n keys live in `src/utils/i18n.ts` (en/zh).
- **No backend** — the only external dependency is PeerJS's signaling server.
- No routing. Tests live in `__tests__/` dirs (53 tests); CI runs lint+test
  before every build.

## Known Issues (as of 1.2.0)

- Protocol control messages (FILE_ACCEPT/CANCEL/…) are plaintext; metadata
  and content are encrypted.
- No pause/resume across sessions; retransmission is per-transfer only.
- Read receipts are best-effort (no retry queue).
- Auto-reconnect covers the signaling layer only; data channels are not
  re-established. Tauri is 1.x while PRD mentions 2.x; no system
  tray/auto-updater.
- Remaining dead code: `SecuritySettings` component, `settingsActions.setTheme`
  / `saveSettings`, `ChatMessage.status` on receiver-side never shown.
