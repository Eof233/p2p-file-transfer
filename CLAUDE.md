# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Vite dev server (port 3000)
npm run build         # Production build (tsc && vite build)
npm run preview       # Preview production build
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
1. `FILE_START` (metadata + `messageType: 'file' | 'image'`)
2. `FILE_ACCEPT` / `FILE_REJECT` — receiver confirmation (>5MB requires
   explicit accept; smaller files auto-accept)
3. `FILE_CHUNK` × N (encrypted when a session key exists)
4. `FILE_END` — receiver reassembles into a Blob (images get an object URL
   patched onto the chat message)
5. `FILE_CANCEL` — either side aborts

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
- **Radix UI + Tailwind**, no Ant Design. Theme tokens are CSS variables in
  `src/styles/globals.css`; i18n keys live in `src/utils/i18n.ts` (en/zh).
- **No backend** — the only external dependency is PeerJS's signaling server.
- No routing, no tests yet, no ESLint/Prettier config.

## Known Issues (as of 1.0.8)

- File metadata and protocol control messages are plaintext (content is
  encrypted).
- No chunk retransmission; a lost chunk fails the transfer.
- No read receipts; no drag & drop; no connection history; auto-reconnect
  covers signaling only.
- Tauri is 1.x while README/PRD mention 2.x; no system tray/auto-updater.
- Some dead code remains: `usePeer`, `useAsyncState`, `validators.ts`,
  unused constants, `FilePreview`, `TransferProgress`, Toast components.
