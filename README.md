# P2P Messenger

Secure, peer-to-peer communication tool with end-to-end encryption. Send messages, files, and images directly between devices without any server intermediary.

## Features

### Messaging
- Real-time text chat via WebRTC data channels
- Markdown in messages: bold, italic, inline code and links, plus fenced code
  blocks with a copy button and lightweight syntax highlighting (js/ts/json/css/bash)
- Typing indicators
- Message status (sent/delivered/read receipts; undelivered receipts retried
  with backoff)
- Inline image display with click-to-preview (auto-compressed before send)
- Per-conversation image gallery opened from the chat header
- File transfer with progress, speed, cancel, pause/resume, and chunk
  retransmission (interrupted transfers can resume within the same session)
- Drag & drop files onto the chat to send them

### Security
- End-to-end encryption (AES-256-GCM + RSA-2048, RSA-OAEP key exchange)
- Perfect Forward Secrecy: per-connection ephemeral ECDH (P-256) keys, with
  AES session keys derived via ECDH + HKDF; RSA-2048 remains the long-term
  identity for fingerprint verification (legacy KEY_EXCHANGE fallback)
- Encrypted file metadata, content, and protocol control messages (chunked)
- Manual fingerprint verification per peer
- Optional encrypted local data: connection history and logs are AES-256-GCM
  encrypted at rest when enabled — key stored locally, so casual-inspection
  protection only (no passphrase)
- No server storage - all data stays on your devices

### Connection
- Peer ID-based connection system
- Accept/reject incoming connection requests (with remote fingerprint)
- Connection quality monitoring (latency, IP, data stats)
- Recent-connections history (localStorage) for quick reconnect
- Automatic signaling reconnection with exponential backoff
- Automatic data-channel reconnect with exponential backoff (1s–30s, up to 10
  attempts): chat and transfers recover from a dropped channel, with a
  "Reconnecting..." sidebar state; fails if the remote restarted its session
- NAT traversal via STUN servers (no TURN server configured)

### Desktop & UX
- Optional Tauri 1.x shell for Windows, macOS (incl. Apple Silicon), Linux
- Desktop notifications for messages while the app is hidden
- Built-in log viewer with level/module filters and an "Errors only" filter
- Light/dark/system themes, English/Chinese UI, reduced-motion support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| State | Redux Toolkit |
| P2P | PeerJS (WebRTC) |
| Desktop | Tauri 1.x (optional shell) |
| UI | Radix UI + Tailwind CSS |
| Encryption | Web Crypto API |
| Build | Vite 5 |
| Tests | Vitest |
| Lint | ESLint 9 + typescript-eslint |

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Rust (for Tauri desktop build)

### Installation

```bash
# Clone the repository
git clone https://github.com/eof233/p2p-file-transfer.git
cd p2p-file-transfer

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Web build
npm run build

# Desktop build (requires Rust)
npm run tauri:build

# macOS ARM64 build
npm run tauri:build:mac-arm
```

## Usage

1. **Start Session** - Click "Start Session" to generate your unique Peer ID
2. **Share ID** - Copy and share your Peer ID with others
3. **Connect** - Enter a peer's ID to send a connection request
4. **Chat** - Once connected, send messages, files, or images

## Project Structure

```
src/
├── components/
│   ├── ui/           # Radix UI primitives
│   ├── chat/         # Chat view, messages, input
│   ├── sidebar/      # Connection list
│   ├── file/         # File transfer UI
│   └── settings/     # App settings
├── store/            # Redux state management
├── services/         # Core services (crypto, file, image, log)
├── hooks/            # Custom React hooks
├── utils/            # Utilities (i18n, formatters, validators)
└── styles/           # CSS design system and animations
src-tauri/            # Tauri desktop app backend (Rust)
```

## Development

### Available Scripts

```bash
npm run dev           # Start Vite dev server
npm run build         # Production build (typecheck + Vite)
npm run preview       # Preview production build
npm test              # Run unit tests (Vitest)
npm run lint          # Run ESLint
npm run tauri:dev     # Start Tauri dev mode
npm run tauri:build   # Build Tauri desktop app
```

### Logging

The app includes a built-in logging system. Access it via Settings > Log Viewer.

```typescript
import { createLogger } from './services/logService'
const log = createLogger('MyModule')

log.info('Operation completed', { data })
log.error('Something failed', { details }, error)
```

### Testing

Unit tests live next to the code under `__tests__/` directories. They run in
Node with Vitest and cover the crypto/encryption services, the file transfer
coordinator, reducers, and utilities.

```bash
npm test          # run once (CI)
npm run test:watch  # watch mode
```

## CI/CD

GitHub Actions workflows are configured for:
- Multi-platform builds (Windows, macOS, Linux)
- Apple Silicon (ARM64) support
- Automatic release creation on tag push

To create a release:
```bash
git tag v1.0.0
git push origin v1.0.0
```

## License

MIT

## Acknowledgments

- [PeerJS](https://peerjs.com/) - WebRTC abstraction
- [Radix UI](https://www.radix-ui.com/) - Accessible UI primitives
- [Tauri](https://tauri.app/) - Desktop application framework
