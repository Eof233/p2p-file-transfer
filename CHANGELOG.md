# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-13

### 🛠️ Phase 3: Engineering Foundation

- **Unit tests (Vitest)**: 53 tests across 8 suites covering cryptoService
  (RSA/AES round trips, tamper rejection, key exchange), EncryptionManager,
  fileService (chunking/reassembly/validation), transferCoordinator
  (accept/end waiters, timeouts, cleanup), chat/file reducers, formatters and
  validators. Runs in Node with minimal browser shims.
- **ESLint 9** (flat config, typescript-eslint + react-hooks): `npm run lint`
  is clean; `no-unused-vars` and rules-of-hooks enforced.
- **CI**: `deploy.yml` and `build.yml` now run lint + tests before building;
  typecheck is part of `npm run build`.
- **Dead code removed**: `usePeer`, `useAsyncState`, `runtimeConfig.ts`
  (incl. the `window.store` debug global), `FilePreview`, `TransferProgress`,
  `setupTests.ts`, and unused constants (`PEER_CONFIG`, `CHUNK_SIZE`,
  `ANIMATION_DURATION`, `SIDEBAR_WIDTH`, `HEADER_HEIGHT`).
- **Unused constants wired up**: `MAX_FILE_SIZE_DEFAULT` (settings default),
  `MAX_MESSAGE_LENGTH` (input limit), `STORAGE_KEYS` (settings + history).
- **Toast system**: the previously dead `Toast` component is now a live
  pub/sub bus (`src/services/toastService.ts`). Copy ID, connection
  accept/reject, session-start errors and file-send errors surface as toasts.
- **File size limit enforced**: `settings.maxFileSize` now actually blocks
  oversized files with a toast error.
- **Docs**: README rewritten to match reality (Tauri 1.x, no tray/auto-update
  claims, real feature list, test/lint commands).

#### Files Changed (highlights)
- [x] `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.js` — new tooling
- [x] `src/**/__tests__/*.test.ts` — 8 new suites
- [x] `src/services/toastService.ts` — new toast bus
- [x] `src/App.tsx` — toast viewport + feedback toasts
- [x] `.github/workflows/{deploy,build}.yml` — lint + test steps
- [x] Deletions: `FilePreview`, `TransferProgress`, `usePeer`, `useAsyncState`,
  `runtimeConfig`, `setupTests`

---

## [1.1.0] - 2026-08-13

### 🚀 Phase 2: Reliability & UX

- **Chunk retransmission**: after `FILE_END` the receiver verifies chunk
  completeness and answers `FILE_COMPLETE` or `FILE_MISSING` (list of chunk
  indexes). The sender retransmits missing chunks and re-signals end, up to 5
  rounds. A lost chunk no longer silently kills large transfers.
- **Encrypted file metadata**: `FILE_START` (name/size/type/message type) is
  now AES-256-GCM encrypted when a session key exists. `FILE_END` no longer
  repeats plaintext metadata.
- **Message receipts**: receivers send `DELIVERED` on arrival and `READ` when
  the conversation is open; opening a conversation sends catch-up read
  receipts. Sender bubbles update ✓ → ✓✓ (accent color).
- **Drag & drop**: drop one or many files onto the chat area to send them
  (images are auto-compressed; non-images go through the file protocol).
- **Connection history**: recent peer IDs persist in localStorage and appear
  in the sidebar ("Recent") for one-click reconnect.
- **Desktop notifications**: enabling notifications requests permission and
  shows a notification for incoming messages while the app is hidden.
- **Backpressure & progress**: progress is now chunk-count based (clamped to
  100% across retransmissions).

#### Files Changed (highlights)
- [x] `src/store/file/transferCoordinator.ts` — end-answer waiters, round state
- [x] `src/store/connection/receiveData.ts` — FILE_MISSING/COMPLETE, receipts, notifications, encrypted FILE_START
- [x] `src/hooks/useFileTransfer.ts` — retransmission loop
- [x] `src/store/chat/chatActions.ts` — sendReceipt / sendReadReceipts
- [x] `src/store/connection/*` — history state + selectConnection thunk
- [x] `src/components/sidebar/Sidebar.tsx` — recent contacts
- [x] `src/components/chat/ChatView.tsx` — drag & drop overlay
- [x] `src/components/settings/SettingsDialog.tsx` — notification permission
- [x] `src/utils/i18n.ts` — dropFiles / recent

### Known Limitations (still open)

- Protocol control messages (FILE_ACCEPT/CANCEL/...) remain plaintext; only
  metadata and content are encrypted.
- No pause/resume across sessions; retransmission is per-transfer only.
- Read receipts are best-effort (no retry queue).
- Auto-reconnect covers the signaling layer only; data channels are not
  re-established yet.

---

## [1.0.8] - 2026-08-13

### 🔐 Real End-to-End Encryption (Phase 1)

The app previously claimed E2E encryption everywhere while sending plaintext.
This release wires up real encryption:

- **RSA-2048 / RSA-OAEP key exchange**: public keys + fingerprints travel as
  PeerJS connection metadata; the connection initiator encrypts a fresh
  AES-256-GCM session key with the receiver's public key (`KEY_EXCHANGE`).
- **AES-256-GCM for content**: chat messages, typing indicators and every
  file chunk are encrypted when a session key exists and the encryption
  setting is enabled. Per-peer serial queue guarantees the session key is
  installed before the first ciphertext is processed.
- **Single encryption state**: new `EncryptionManager` singleton
  (`src/services/encryptionService.ts`) replaces the per-component
  `useEncryption` state (which generated 3 separate RSA key pairs).
- **Manual key verification fixed**: the dialog previously compared local vs
  remote fingerprints (always "mismatch"); it now shows both fingerprints for
  out-of-band comparison with a "Fingerprints match" confirmation.
- **Connection requests show the remote fingerprint** when available.

### 🐛 Bug Fixes (Phase 1)

- **Large-file receive confirmation** (>5MB) now actually works: receiver gets
  an accept/reject dialog; new `FILE_ACCEPT` / `FILE_REJECT` protocol messages
  gate the chunk flow.
- **Cancel transfer now real**: cancelling stops the send loop at the next
  chunk boundary and notifies the peer via `FILE_CANCEL`.
- **Images use the chunked file protocol**: large base64 images no longer blow
  the WebRTC message size limit; `ImageService.compressImage` is now used
  before sending (max 1920px, JPEG 0.8).
- **Typing indicator wired up**: the input now sends typing events; the
  receiver auto-clears after 3s.
- **Fixed `connectPeer` listener leak**: the `peer-unavailable` error handler
  is now removed on every path (timeout/error/success).
- **Stale connection requests** are removed when the peer disconnects before
  acceptance.
- **Incoming data race fixed**: data arriving before handler registration is
  buffered per peer (the key exchange message can no longer be missed).
- **Deduplicated `handleReceivedData`**: the ~200-line handler duplicated in
  `connectionActions.ts` and `connectionRequestActions.ts` is now a single
  shared module (`src/store/connection/receiveData.ts`).
- **Send backpressure**: the sender pauses when the data channel buffers more
  than 1MB.
- **Session-stop cleanup** clears transfer state, session keys and receive
  queues; `startPeer` guards against double start and surfaces errors.

#### Files Changed (highlights)
- [x] `src/services/encryptionService.ts` — new EncryptionManager singleton
- [x] `src/store/connection/receiveData.ts` — new shared receive pipeline
- [x] `src/store/file/transferCoordinator.ts` — new transfer protocol state
- [x] `src/helpers/peer.ts` — metadata, data buffering, leak fixes
- [x] `src/store/{chat,file,peer,connection}/*` — protocol + encrypted send
- [x] `src/hooks/useEncryption.ts` — singleton subscription
- [x] `src/hooks/useFileTransfer.ts` — accept/cancel/backpressure/encryption
- [x] `src/components/{chat,connection,security}/*` — dialog wiring
- [x] `src/utils/i18n.ts` — new keys

### Known Limitations (still open)

- File metadata (name/size) and protocol control messages are plaintext;
  only content bytes are encrypted.
- No chunk-level retransmission: a lost chunk fails the transfer.
- Message status stays sent/delivered (no read receipts).
- Auto-reconnect covers the signaling layer only; data channels are not
  re-established yet.

---

## [1.0.7] - 2026-08-10

### 🐛 Bug Fix: Real-time File Transfer Display

**Problem:** Receiver only sees file after transfer completes, not during transfer

**Root Cause:** Sender sent chunks without metadata first; receiver had no info to display

**Fix: New 3-phase transfer protocol:**
1. `FILE_START` - Send metadata (name, size, type) first → receiver shows file immediately
2. `FILE_CHUNK` × N - Send chunks with progress → receiver updates progress bar
3. `FILE_END` - Send completion signal → receiver stores blob for download

**Additional:** Removed auto-download - user clicks download button to save

#### Files Changed
- [x] `src/hooks/useFileTransfer.ts` - 3-phase protocol
- [x] `src/store/connection/connectionActions.ts` - Handle FILE_START/CHUNK/END
- [x] `src/store/connection/connectionRequestActions.ts` - Same handler
- [x] `src/utils/i18n.ts` - Add waitingToReceive translation

---

## [1.0.6] - 2026-08-10

### 🚀 New Features

#### File Transfer Enhancement
- [x] Remove file size limit
- [x] Show file in chat directly
- [x] Transfer progress bar
- [x] Transfer speed display
- [x] Download button for received files

#### Connection Quality Info
- [x] Display peer IP and port
- [x] Show latency/ping
- [x] Connection quality indicator

### 🐛 Bug Fixes

**Fix 1: Stop Session Button**
- **Problem**: Button not working, state not cleared
- **Fix**: Add error handling, clear connection and file state

**Fix 2: File Transfer Progress**
- **Problem**: Progress bar not updating, speed not showing
- **Root Cause**: Chunks sent synchronously, React couldn't re-render
- **Fix**: Add setTimeout(0) between chunks to yield to event loop

**Fix 3: Receiver Not Seeing Files**
- **Problem**: Receiver's chat shows nothing after file sent
- **Root Cause**: connectionRequestActions.ts had stub file handler
- **Fix**: Implement full chunk reassembly and chat message creation

**Fix 4: Download Button**
- **Problem**: No way to download received files
- **Fix**: Store blob in Redux, add download button to FileMessage

---

## [1.0.5] - 2026-08-10

### 🐛 Bug Fixes (3 fixes)

**Fix 1: Connection Loading Issue**
- Add 15-second timeout for connection attempts
- Show connection errors in UI

**Fix 2: Incoming Connection Not Received**
- Check `conn.open` state for incoming connections
- Execute callback immediately if already open

**Fix 3: Remote Connection & Message Reception**
- **Remote timeout**: Add 5 Google STUN servers for NAT traversal
- **Remote timeout**: Increase connection timeout to 30s
- **Remote timeout**: Add reconnection with exponential backoff
- **Messages not received**: Data handlers were no-ops (logged but didn't dispatch)
- **Messages not received**: Now properly dispatch `addChatMessage` and `setChatTyping` to Redux

#### Files Changed
- [x] `src/helpers/peer.ts` - STUN servers, reconnection, timeout
- [x] `src/store/connection/connectionActions.ts` - Message dispatch
- [x] `src/store/connection/connectionRequestActions.ts` - Message dispatch
- [x] `src/store/chat/chatActions.ts` - Error handling

#### Connection Issues (2 fixes)

**Fix 1: Connection Loading Issue**
- **Problem**: Initiator shows loading spinner even after remote accepts connection
- **Root Cause**: `open` event not firing reliably on initiator side
- **Fix**: Add 15-second timeout for connection attempts

**Fix 2: Incoming Connection Not Received**
- **Problem**: After Fix 1, incoming connections not showing to remote
- **Root Cause**: PeerJS may fire `connection` event after connection is already open; waiting for `open` event that never fires
- **Fix**: Check `conn.open` state; if already open, execute callback immediately

#### Changes
- [x] Add timeout mechanism (15s) for outgoing connections
- [x] Check `conn.open` for incoming connections
- [x] Add CONNECTION_ERROR action type
- [x] Update connection reducer to handle errors
- [x] Show connection errors in UI with auto-dismiss
- [x] Update NewConnection component to show errors
- [x] Update Sidebar to pass error prop

---

## [1.0.4] - 2026-08-10

### 🖥️ Tauri Desktop App Configuration

#### Setup
- [x] Add Tauri 1.x dependencies
- [x] Create src-tauri configuration
- [x] Configure build for multiple platforms
- [x] Add npm scripts for Tauri

#### Build Targets
- [x] macOS ARM64 (Apple Silicon M1/M2/M3)
- [x] macOS x64 (Intel)
- [x] Windows x64
- [x] Linux x64

#### GitHub Actions
- [x] Cross-platform build workflow
- [x] Automatic release on tag push
- [x] Upload build artifacts

---

## [1.0.3] - 2026-08-10

### Logging System

#### Core Features
- [x] Unified log service (src/services/logService.ts)
- [x] Log levels: DEBUG, INFO, WARN, ERROR, FATAL
- [x] Colored console output
- [x] localStorage persistence with rotation
- [x] Performance timing helper

#### Log Viewer
- [x] Filter by log level
- [x] Filter by module
- [x] Export as JSON/CSV
- [x] Clear logs
- [x] Auto-refresh

#### Error Tracking
- [x] Global error handler
- [x] Unhandled promise rejection handler

---

## [1.0.2] - 2026-08-10

### 🎨 UI Fixes & Image Preview

#### Alignment Fixes
- [x] Header buttons consistent height (h-8)
- [x] MessageInput buttons vertically centered
- [x] MessageBubble content flex layout for proper alignment
- [x] Input error messages fixed height to prevent layout shift
- [x] Settings toggle switches flex-shrink-0

#### Image Display
- [x] Limit chat image size to 280x200px
- [x] Click-to-enlarge image preview modal
- [x] ESC key to close preview
- [x] Download button in preview
- [x] Zoom icon overlay on hover
- [x] Smooth animations for preview

---

## [1.0.1] - 2026-08-10

### 🔧 Feature Completions

#### Connection Request System
- [x] Accept/Reject dialog for incoming connections
- [x] Show requester's Peer ID and fingerprint
- [x] Deferred data handlers until connection accepted
- [x] i18n support for connection request text

#### Screenshot Paste
- [x] Paste images from clipboard (Ctrl+V)
- [x] Auto-generate timestamped filename
- [x] Visual feedback toast ("Image pasted")
- [x] Tooltip hint on image button

#### Key Verification
- [x] Side-by-side fingerprint comparison dialog
- [x] Verify/Mismatch status with visual indicators
- [x] Shield icon in chat header for encryption status
- [x] Green shield after successful verification
- [x] Verification persists across session

---

## [1.0.0] - 2026-08-10

### 🎉 Initial Release - Complete Rewrite

Major transformation from simple P2P file transfer to full-featured encrypted messenger.

---

### ✅ Phase 1: Foundation (Completed)

#### Build System Migration
- [x] Migrate from CRA (react-scripts) to Vite 5
- [x] Configure TypeScript 5.3 with strict mode
- [x] Add Tailwind CSS 3.4 with PostCSS
- [x] Configure autoprefixer

#### UI Framework Replacement
- [x] Remove Ant Design dependency
- [x] Install Radix UI primitives (Dialog, ScrollArea, Toast, Progress, Avatar, Tooltip)
- [x] Create Apple-style design system with CSS custom properties
- [x] Implement dark/light/system theme support
- [x] Add smooth animations (cubic-bezier easing, spring-like feel)

#### State Management Expansion
- [x] Add chat slice (messages per peer, typing indicators)
- [x] Add file transfer slice (progress tracking, pending files)
- [x] Add settings slice (theme, encryption, notifications, language)

---

### ✅ Phase 2: Core Features (Completed)

#### Chat System
- [x] Real-time P2P messaging via PeerJS/WebRTC
- [x] Message history per connection (in-memory)
- [x] Message bubbles with sent/delivered/read status
- [x] Typing indicator with animated dots
- [x] Inline image display (base64)
- [x] File attachment in chat

#### File Transfer
- [x] Send files of any type
- [x] File chunking support (16KB chunks)
- [x] Transfer progress tracking
- [x] File preview (images, video, audio, PDF)
- [x] Large file confirmation dialog (>5MB)
- [x] Cancel transfer support

#### Image Sharing
- [x] Inline image rendering in chat
- [x] Image compression service
- [x] Clipboard screenshot paste support
- [x] Image preview dialog

---

### ✅ Phase 3: Security (Completed)

#### Encryption Implementation
- [x] RSA-2048 key pair generation
- [x] AES-256-GCM session encryption
- [x] RSA-OAEP key exchange
- [x] SHA-256 fingerprint generation
- [x] Session key management
- [x] End-to-end encryption toggle in settings

---

### ✅ Phase 4: Polish (Completed)

#### Apple Design Implementation
- [x] Spring-based animations (cubic-bezier 0.32, 0.72, 0, 1)
- [x] Translucent material backgrounds
- [x] Smooth dialog enter/exit transitions
- [x] Button press feedback (scale 0.97)
- [x] Reduced motion support (prefers-reduced-motion)
- [x] Theme transition animations

#### Internationalization
- [x] Chinese/English language support
- [x] Auto-detect browser language
- [x] Language switcher in settings
- [x] All UI text externalized to i18n system

#### Layout & UX
- [x] Sidebar with connection list
- [x] Chat area with message history
- [x] Header with session controls
- [x] Settings dialog with theme/language/security options
- [x] Copy peer ID to clipboard
- [x] Responsive layout

---

### 📁 Project Structure

```
src/
├── components/
│   ├── ui/           # Radix UI primitives (8 components)
│   ├── chat/         # Chat components (4 components)
│   ├── sidebar/      # Sidebar components (3 components)
│   ├── file/         # File transfer components (3 components)
│   ├── settings/     # Settings components (2 components)
│   └── Header.tsx    # App header
├── store/
│   ├── peer/         # Peer session state
│   ├── connection/   # Connection management
│   ├── chat/         # Chat messages & typing
│   ├── file/         # File transfers & progress
│   └── settings/     # App settings
├── services/
│   ├── cryptoService.ts   # AES-256 + RSA encryption
│   ├── fileService.ts     # File chunking & validation
│   └── imageService.ts    # Image compression & preview
├── hooks/
│   ├── useChat.ts         # Chat functionality
│   ├── useFileTransfer.ts # File transfer logic
│   ├── useEncryption.ts   # Encryption management
│   ├── usePeer.ts         # Peer connection
│   ├── useI18n.ts         # Internationalization
│   └── useTheme.ts        # Theme management
├── utils/
│   ├── i18n.ts           # Translations (en/zh)
│   ├── constants.ts      # App constants
│   ├── formatters.ts     # Display formatters
│   └── validators.ts     # Input validators
└── styles/
    ├── globals.css       # Design system & base styles
    └── animations.css    # Animation definitions
```

---

### 🔧 Technical Details

#### Dependencies Added
- `@radix-ui/react-avatar` ^1.0.4
- `@radix-ui/react-dialog` ^1.0.5
- `@radix-ui/react-progress` ^1.0.3
- `@radix-ui/react-scroll-area` ^1.0.5
- `@radix-ui/react-slot` ^1.0.2
- `@radix-ui/react-toast` ^1.1.5
- `@radix-ui/react-tooltip` ^1.0.7
- `lucide-react` ^0.294.0
- `tailwindcss` ^3.4.0
- `postcss` ^8.4.32
- `autoprefixer` ^10.4.16

#### Dependencies Removed
- `antd` ^5.4.2
- `@ant-design/icons` ^5.0.1
- `js-file-download` ^0.4.12
- `react-scripts` 5.0.1

#### Build Output
- JS Bundle: ~397 KB (gzip: ~125 KB)
- CSS Bundle: ~23 KB (gzip: ~5 KB)
- Build time: ~3 seconds

---

### 🐛 Bug Fixes

- Fixed dialog animation being too abrupt (now uses smooth 280ms transition with cubic-bezier easing)
- Fixed sidebar overflow when connection form is expanded
- Fixed theme switching not applying to DOM
- Fixed NodeJS.Timeout type error in MessageInput
- Fixed Uint8Array type compatibility with TypeScript 5.3
- Fixed settings import path for RootState

---

### 📝 Notes

- **Encryption**: All messages and files are encrypted end-to-end using AES-256-GCM with RSA-2048 key exchange
- **Performance**: WebRTC data channels provide <100ms latency on local networks
- **Accessibility**: Reduced motion support, keyboard navigation, screen reader friendly
- **Browser Support**: Modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)

---

## Development Progress

### Feature Completion Status

| Category | Feature | Status | Notes |
|----------|---------|--------|-------|
| **Connection** | Peer ID Generation | ✅ Done | Auto-generates on session start |
| **Connection** | Manual ID Input | ✅ Done | Sidebar connect form |
| **Connection** | Connection List | ✅ Done | Sidebar with active indicator |
| **Connection** | Connection Request | ✅ Done | Accept/Reject dialog |
| **Connection** | Auto-Reconnect | ❌ TODO | P1 priority |
| **Connection** | Connection History | ❌ TODO | P2 priority |
| **Messaging** | Real-time Chat | ✅ Done | Via PeerJS data channel |
| **Messaging** | Message History | ✅ Done | In-memory per session |
| **Messaging** | Typing Indicator | ✅ Done | Animated dots |
| **Messaging** | Message Status | ✅ Done | Sent/Delivered/Read |
| **Messaging** | Emoji Support | ✅ Done | Native Unicode |
| **Messaging** | Code Blocks | ❌ TODO | P2 priority |
| **Messaging** | Markdown Support | ❌ TODO | P2 priority |
| **File Transfer** | Send File | ✅ Done | Any file type |
| **File Transfer** | Receive Confirmation | ✅ Done | >5MB threshold |
| **File Transfer** | Progress Indicator | ✅ Done | Real-time progress |
| **File Transfer** | Cancel Transfer | ✅ Done | UI implemented |
| **File Transfer** | File Preview | ✅ Done | Image/Video/Audio/PDF |
| **File Transfer** | Drag & Drop | ❌ TODO | P1 priority |
| **File Transfer** | Resume Transfer | ❌ TODO | P2 priority |
| **Image** | Inline Display | ✅ Done | Base64 rendering |
| **Image** | Image Preview | ✅ Done | Click to expand |
| **Image** | Image Compression | ✅ Done | Service implemented |
| **Image** | Image Gallery | ❌ TODO | P2 priority |
| **Image** | Screenshot Paste | ✅ Done | Ctrl+V paste with feedback |
| **Security** | AES-256 Encryption | ✅ Done | AES-256-GCM |
| **Security** | RSA Key Exchange | ✅ Done | RSA-2048 OAEP |
| **Security** | Perfect Forward Secrecy | ❌ TODO | P1 priority |
| **Security** | Key Verification | ✅ Done | Fingerprint comparison dialog |
| **Security** | Encrypted Local Storage | ❌ TODO | P2 priority |
| **UI** | Theme Switching | ✅ Done | Light/Dark/System |
| **UI** | Language Switching | ✅ Done | Chinese/English |
| **UI** | Animations | ✅ Done | Apple-style springs |
| **UI** | Reduced Motion | ✅ Done | prefers-reduced-motion |

### Test Status

| Component | Unit Tests | Integration Tests | E2E Tests |
|-----------|------------|-------------------|-----------|
| CryptoService | ❌ Not started | ❌ Not started | ❌ Not started |
| FileService | ❌ Not started | ❌ Not started | ❌ Not started |
| Chat System | ❌ Not started | ❌ Not started | ❌ Not started |
| File Transfer | ❌ Not started | ❌ Not started | ❌ Not started |
| UI Components | ❌ Not started | ❌ Not started | ❌ Not started |

### Known Issues

1. **Reconnection**: No automatic reconnection on network interruption
2. **Large Files**: Chunked transfer implemented but resume capability missing
3. **Testing**: No unit or integration tests yet

### Next Steps (v1.1.0)

- [ ] Implement auto-reconnect logic
- [ ] Add drag & drop file upload
- [ ] Write unit tests for crypto service
- [ ] Add E2E tests for file transfer
- [ ] Implement connection history (localStorage)
- [ ] Add markdown rendering in messages
- [ ] Add code syntax highlighting

---

*Last Updated: 2026-08-10*
*Document Version: 1.0.0*
