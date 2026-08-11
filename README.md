# P2P Messenger

Secure, peer-to-peer communication tool with end-to-end encryption. Send messages, files, and images directly between devices without any server intermediary.

## Features

### Messaging
- Real-time text chat via WebRTC data channels
- Typing indicators
- Message status (sent/delivered/read)
- Inline image display with click-to-preview
- File transfer with progress tracking and speed display

### Security
- End-to-end encryption (AES-256-GCM + RSA-2048)
- RSA-OAEP key exchange
- Fingerprint verification
- No server storage - all data stays on your devices

### Connection
- Peer ID-based connection system
- Accept/reject incoming connection requests
- Connection quality monitoring (latency, IP, data stats)
- Automatic reconnection with exponential backoff
- NAT traversal via STUN servers

### Desktop App (Tauri)
- Native performance on Windows, macOS, Linux
- Apple Silicon (M1/M2/M3) support
- System tray integration
- Auto-update support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| State | Redux Toolkit |
| P2P | PeerJS (WebRTC) |
| Desktop | Tauri 2.x |
| UI | Radix UI + Tailwind CSS |
| Encryption | Web Crypto API |
| Build | Vite 5 |

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
npm run build         # Production build
npm run preview       # Preview production build
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
