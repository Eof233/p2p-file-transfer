# P2P Messenger - Product Requirements Document

## 1. Product Overview

**Product Name:** P2P Messenger
**Version:** 1.0.0
**Platform:** Windows/macOS/Linux (Tauri Desktop Application)
**Base:** Current p2p-file-transfer project (React + PeerJS + Redux)

A secure, peer-to-peer communication tool that enables direct text messaging, file transfer, and image sharing between users through unique connection IDs. Built with Apple's design philosophy for fluid, responsive interfaces.

---

## 2. Core Features

### 2.1 Connection Management

| Feature | Description | Priority |
|---------|-------------|----------|
| **Peer ID Generation** | Auto-generate unique peer ID on session start | P0 |
| **Manual ID Input** | Connect to peer by entering their ID | P0 |
| **Connection List** | Display all active connections with status | P0 |
| **Connection Request** | Accept/Reject incoming connection requests | P0 |
| **Auto-Reconnect** | Re-establish connection on network interruption | P1 |
| **Connection History** | Remember recent connections (local storage) | P2 |

### 2.2 Text Messaging

| Feature | Description | Priority |
|---------|-------------|----------|
| **Real-time Chat** | Instant text message delivery via P2P | P0 |
| **Message History** | In-session message history per connection | P0 |
| **Typing Indicator** | Show when peer is typing | P1 |
| **Message Status** | Sent/Delivered/Read indicators | P1 |
| **Emoji Support** | Native emoji input (Unicode, not custom icons) | P1 |
| **Code Blocks** | Syntax-highlighted code snippets | P2 |
| **Markdown Support** | Basic markdown rendering (bold, italic, links) | P2 |

### 2.3 File Transfer

| Feature | Description | Priority |
|---------|-------------|----------|
| **Send File** | Select and send files of any type | P0 |
| **Receive Confirmation** | Receiver must accept large files (>5MB) before transfer | P0 |
| **Progress Indicator** | Real-time transfer progress with speed/ETA | P0 |
| **Cancel Transfer** | Abort ongoing file transfer | P0 |
| **File Preview** | Preview received files before saving | P1 |
| **Drag & Drop** | Drop files directly into chat to send | P1 |
| **Resume Transfer** | Resume interrupted transfers | P2 |

### 2.4 Image Sharing

| Feature | Description | Priority |
|---------|-------------|----------|
| **Inline Image Display** | Images render directly in chat (base64/blob) | P0 |
| **Image Preview** | Click to view full-size image | P0 |
| **Image Compression** | Auto-compress large images before sending | P1 |
| **Image Gallery** | Grid view of all shared images | P2 |
| **Screenshot Paste** | Paste clipboard screenshots directly | P1 |

### 2.5 Security & Encryption

| Feature | Description | Priority |
|---------|-------------|----------|
| **AES-256 Encryption** | Encrypt all messages and files with AES-256-GCM | P0 |
| **RSA Key Exchange** | Use RSA-2048 for secure key exchange | P0 |
| **Perfect Forward Secrecy** | Generate new session keys for each connection | P1 |
| **Key Verification** | Manual fingerprint verification option | P1 |
| **Encrypted Local Storage** | Encrypt chat history stored locally | P2 |

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| **Framework** | React 18 + TypeScript | Existing codebase |
| **State Management** | Redux Toolkit | Existing codebase |
| **P2P Communication** | PeerJS (WebRTC) | Existing codebase, reliable P2P data channels |
| **Desktop Framework** | Tauri 2.x | Native performance, smaller bundle than Electron |
| **UI Components** | Radix UI + Tailwind CSS | Apple-style design compatibility, accessible, unstyled primitives |
| **Icons** | Lucide React | Clean, consistent line icons (no emoji for UI) |
| **Encryption** | Web Crypto API + RSA-OAEP | Native browser/Node crypto, no external dependencies |
| **Animation** | Motion (Framer Motion) | Spring-based animations per Apple Design principles |

### 3.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri Shell                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   React Frontend                      │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │  Chat   │  │  File   │  │  Image  │  │Settings │ │  │
│  │  │ Module  │  │Transfer │  │ Viewer  │  │ Module  │ │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘ │  │
│  │       │            │            │            │       │  │
│  │  ┌────┴────────────┴────────────┴────────────┴────┐  │  │
│  │  │              Redux Store                        │  │  │
│  │  │  (peer, connection, chat, file, settings)       │  │  │
│  │  └────────────────────┬────────────────────────────┘  │  │
│  │                       │                               │  │
│  │  ┌────────────────────┴────────────────────────────┐  │  │
│  │  │           Service Layer                          │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│  │  │
│  │  │  │ PeerJS   │ │  Crypto  │ │ File/Image Utils ││  │  │
│  │  │  │ Service  │ │ Service  │ │    Service       ││  │  │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘│  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Tauri Backend (Rust)                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │ File System  │  │   System     │  │   Crypto    │ │  │
│  │  │   Access     │  │  Keychain    │  │  Hardware   │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ WebRTC Data Channel          │ WebRTC Data Channel
         │ (Encrypted)                  │ (Encrypted)
         ▼                              ▼
    ┌─────────┐                   ┌─────────┐
    │ Peer A  │◄──────────────────│ Peer B  │
    └─────────┘                   └─────────┘
```

### 3.3 Data Flow

```
User Input → Action → Redux Dispatch → Service Layer → PeerJS → WebRTC → Peer
                ↑                                                              │
                └──────────────── Response ◄──────────────────────────────────┘
```

### 3.4 Encryption Flow

```
1. Connection Established
2. RSA Key Exchange (public keys exchanged via PeerJS signaling)
3. Generate AES-256 Session Key
4. Encrypt session key with peer's RSA public key
5. All subsequent messages/files encrypted with AES-256-GCM
6. Session key discarded on disconnect
```

---

## 4. UI Design Specification

### 4.1 Design Principles (Apple Design)

Based on the `apple-design` skill:

| Principle | Application |
|-----------|-------------|
| **Response** | Instant feedback on pointer-down, no latency |
| **Direct Manipulation** | 1:1 tracking for drag operations |
| **Interruptibility** | All animations interruptible via springs |
| **Spatial Consistency** | Symmetric enter/exit paths |
| **Materials** | Translucent surfaces with backdrop-filter |
| **Typography** | System font, size-specific tracking |
| **Reduced Motion** | Respect prefers-reduced-motion |

### 4.2 Color System

```css
:root {
  /* Light Mode */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F2F2F7;
  --bg-tertiary: #E5E5EA;
  --text-primary: #000000;
  --text-secondary: #3C3C43;
  --text-tertiary: #8E8E93;
  --accent: #007AFF;
  --success: #34C759;
  --warning: #FF9500;
  --error: #FF3B30;
  --separator: rgba(60, 60, 67, 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #000000;
    --bg-secondary: #1C1C1E;
    --bg-tertiary: #2C2C2E;
    --text-primary: #FFFFFF;
    --text-secondary: #EBEBF5;
    --text-tertiary: #8E8E93;
    --accent: #0A84FF;
    --success: #30D158;
    --warning: #FF9F0A;
    --error: #FF453A;
    --separator: rgba(84, 84, 88, 0.36);
  }
}
```

### 4.3 Component Library

**Primary:** Radix UI Primitives + Tailwind CSS
**Icons:** Lucide React (line-style, consistent, no emoji)

| Component | Radix Primitive | Customization |
|-----------|-----------------|---------------|
| Button | `@radix-ui/react-slot` | Apple-style press feedback |
| Dialog | `@radix-ui/react-dialog` | Sheet-style for mobile |
| Dropdown | `@radix-ui/react-dropdown-menu` | Translucent material |
| Tooltip | `@radix-ui/react-tooltip` | Delayed show, instant hide |
| Toast | `@radix-ui/react-toast` | Slide-in animation |
| Scroll Area | `@radix-ui/react-scroll-area` | Thin scrollbar |
| Avatar | `@radix-ui/react-avatar` | Status indicator |
| Progress | `@radix-ui/react-progress` | Smooth animation |
| Tabs | `@radix-ui/react-tabs` | Pill-style indicator |
| Switch | `@radix-ui/react-switch` | iOS-style toggle |

### 4.4 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Header Bar                         │  │
│  │  [P2P Messenger]              [Settings] [My ID: xxx] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────┬────────────────────────────────────────────┐  │
│  │          │                                            │  │
│  │ Sidebar  │              Chat Area                     │  │
│  │          │                                            │  │
│  │ ┌──────┐ │  ┌──────────────────────────────────────┐ │  │
│  │ │Peer 1│ │  │                                      │ │  │
│  │ │  ●   │ │  │         Message History               │ │  │
│  │ └──────┘ │  │                                      │ │  │
│  │ ┌──────┐ │  │  [Avatar] Message text               │ │  │
│  │ │Peer 2│ │  │                                      │ │  │
│  │ │  ○   │ │  │           Message text [Avatar]      │ │  │
│  │ └──────┘ │  │                                      │ │  │
│  │ ┌──────┐ │  │  [Inline Image Preview]              │ │  │
│  │ │+ New │ │  │                                      │ │  │
│  │ └──────┘ │  └──────────────────────────────────────┘ │  │
│  │          │                                            │  │
│  │          │  ┌──────────────────────────────────────┐ │  │
│  │          │  │ [+] [Image] [Emoji]    Message Input │ │  │
│  │          │  └──────────────────────────────────────┘ │  │
│  └──────────┴────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Animation Specifications

Per Apple Design + animate skill:

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Button press | scale(0.97) | 100ms | ease-out |
| Message appear | slide up + fade | 200ms | cubic-bezier(0.23, 1, 0.32, 1) |
| Image expand | scale from thumbnail | 250ms | spring(damping: 0.8, response: 0.3) |
| File transfer progress | smooth width | 300ms | ease-in-out |
| Sidebar item select | background fade | 150ms | ease |
| Connection status | opacity pulse | 2s | linear (loop) |
| Toast notification | slide from bottom | 200ms | ease-out |
| Modal/Dialog | scale(0.95) + fade | 250ms | cubic-bezier(0.23, 1, 0.32, 1) |

---

## 5. Project Structure

```
p2p-messenger/
├── src/
│   ├── components/
│   │   ├── ui/                    # Radix UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── ScrollArea.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ...
│   │   ├── chat/
│   │   │   ├── ChatView.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── ImageMessage.tsx
│   │   │   └── FileMessage.tsx
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ConnectionItem.tsx
│   │   │   └── NewConnection.tsx
│   │   ├── file/
│   │   │   ├── FileTransferDialog.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── TransferProgress.tsx
│   │   └── settings/
│   │       ├── SettingsDialog.tsx
│   │       └── SecuritySettings.tsx
│   ├── store/
│   │   ├── peer/
│   │   │   ├── peerActions.ts
│   │   │   ├── peerReducer.ts
│   │   │   └── peerTypes.ts
│   │   ├── connection/
│   │   │   ├── connectionActions.ts
│   │   │   ├── connectionReducer.ts
│   │   │   └── connectionTypes.ts
│   │   ├── chat/
│   │   │   ├── chatActions.ts
│   │   │   ├── chatReducer.ts
│   │   │   └── chatTypes.ts
│   │   ├── file/
│   │   │   ├── fileActions.ts
│   │   │   ├── fileReducer.ts
│   │   │   └── fileTypes.ts
│   │   └── settings/
│   │       ├── settingsActions.ts
│   │       ├── settingsReducer.ts
│   │       └── settingsTypes.ts
│   ├── services/
│   │   ├── peerService.ts         # PeerJS wrapper
│   │   ├── cryptoService.ts       # AES + RSA encryption
│   │   ├── fileService.ts         # File chunking, compression
│   │   └── imageService.ts        # Image processing
│   ├── hooks/
│   │   ├── usePeer.ts
│   │   ├── useChat.ts
│   │   ├── useFileTransfer.ts
│   │   └── useEncryption.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── animations.css
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                     # Tauri backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   └── commands/
│   │       ├── file.rs
│   │       ├── crypto.rs
│   │       └── system.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 6. Migration Plan

### Phase 1: Foundation (Week 1-2)

1. **Migrate from CRA to Vite + Tauri**
   - Replace react-scripts with Vite
   - Initialize Tauri project structure
   - Configure build pipeline

2. **Replace Ant Design with Radix UI + Tailwind**
   - Install Radix UI primitives
   - Install Tailwind CSS
   - Create base UI components
   - Remove Ant Design dependencies

3. **Update State Management**
   - Add chat slice (messages, history)
   - Add file transfer slice (progress, queue)
   - Add settings slice (encryption, theme)

### Phase 2: Core Features (Week 3-4)

4. **Implement Chat System**
   - Message data model
   - Real-time messaging via PeerJS
   - Message history (in-memory)
   - Message UI components

5. **Enhance File Transfer**
   - Chunked file transfer
   - Transfer confirmation dialog
   - Progress tracking
   - Cancel/resume support

6. **Add Image Support**
   - Inline image rendering
   - Image compression
   - Preview functionality

### Phase 3: Security (Week 5)

7. **Implement Encryption**
   - RSA key generation and exchange
   - AES-256-GCM session encryption
   - Encrypted data channel wrapper
   - Key verification UI

### Phase 4: Polish (Week 6)

8. **Apple Design Implementation**
   - Spring animations
   - Translucent materials
   - Haptic feedback (Tauri)
   - Reduced motion support

9. **Testing & Optimization**
   - Unit tests for crypto service
   - E2E tests for file transfer
   - Performance optimization
   - Bundle size optimization

---

## 7. API Reference

### 7.1 Peer Service

```typescript
interface PeerService {
  // Lifecycle
  startSession(): Promise<string>;        // Returns peer ID
  stopSession(): Promise<void>;
  
  // Connection
  connectToPeer(id: string): Promise<void>;
  disconnectFromPeer(id: string): void;
  onIncomingConnection(callback: (conn: PeerConnection) => void): void;
  
  // Messaging
  sendMessage(peerId: string, message: EncryptedMessage): Promise<void>;
  onMessageReceived(callback: (message: EncryptedMessage) => void): void;
  
  // File Transfer
  sendFile(peerId: string, file: FileChunk): Promise<void>;
  onFileReceived(callback: (file: FileChunk) => void): void;
  
  // Status
  onConnectionStatusChange(callback: (status: ConnectionStatus) => void): void;
}
```

### 7.2 Crypto Service

```typescript
interface CryptoService {
  // Key Management
  generateKeyPair(): Promise<RSAKeyPair>;
  exportPublicKey(key: CryptoKey): Promise<string>;
  importPublicKey(keyData: string): Promise<CryptoKey>;
  
  // Encryption
  generateSessionKey(): Promise<CryptoKey>;
  encryptSessionKey(sessionKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer>;
  decryptSessionKey(encryptedKey: ArrayBuffer, privateKey: CryptoKey): Promise<CryptoKey>;
  
  // Data Encryption
  encrypt(data: ArrayBuffer, sessionKey: CryptoKey): Promise<EncryptedData>;
  decrypt(data: EncryptedData, sessionKey: CryptoKey): Promise<ArrayBuffer>;
  
  // Verification
  generateFingerprint(publicKey: CryptoKey): Promise<string>;
}
```

### 7.3 File Service

```typescript
interface FileService {
  // Chunking
  chunkFile(file: File, chunkSize?: number): FileChunk[];
  reassembleChunks(chunks: FileChunk[]): Blob;
  
  // Compression
  compressImage(file: File, maxWidth?: number, quality?: number): Promise<File>;
  
  // Validation
  validateFileSize(file: File, maxSize: number): boolean;
  validateFileType(file: File, allowedTypes: string[]): boolean;
}
```

---

## 8. Configuration

### 8.1 Tauri Configuration

```json
{
  "productName": "P2P Messenger",
  "version": "1.0.0",
  "identifier": "com.p2p-messenger.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "P2P Messenger",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' wss: ws:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 8.2 PeerJS Configuration

```typescript
const PEER_CONFIG = {
  debug: 0,
  host: 'peerjs-server.com',  // or self-hosted
  port: 443,
  secure: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};
```

---

## 9. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | Message latency | < 100ms (local network) |
| **Performance** | File transfer speed | > 1 MB/s |
| **Performance** | App startup time | < 2 seconds |
| **Performance** | Memory usage | < 200MB |
| **Security** | Encryption standard | AES-256-GCM + RSA-2048 |
| **Security** | Key exchange | RSA-OAEP |
| **Reliability** | Connection success rate | > 95% |
| **Reliability** | Message delivery | Guaranteed (with retry) |
| **Accessibility** | WCAG compliance | AA level |
| **Accessibility** | Keyboard navigation | Full support |
| **Accessibility** | Screen reader | Full support |

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Connection success rate | > 95% | Analytics |
| Message delivery rate | > 99% | Analytics |
| File transfer completion | > 90% | Analytics |
| User satisfaction | > 4.5/5 | In-app survey |
| App crash rate | < 0.1% | Error tracking |
| Encryption overhead | < 10% size increase | Benchmarks |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebRTC connection failures | High | STUN/TURN server fallback |
| Large file transfer interruption | Medium | Chunked transfer with resume |
| Encryption key compromise | High | Perfect forward secrecy, key rotation |
| Browser Web Crypto limitations | Medium | Tauri native crypto fallback |
| PeerJS server downtime | High | Self-hosted option |

---

## 12. Future Enhancements (v2.0+)

- [ ] Group chat (multi-peer mesh)
- [ ] Voice/Video calls (WebRTC media)
- [ ] Screen sharing
- [ ] End-to-end encrypted file search
- [ ] Mobile companion app (React Native)
- [ ] Plugin system for custom features
- [ ] Self-hosted PeerJS server option
- [ ] Message threading
- [ ] File versioning
- [ ] Integration with cloud storage (optional)

---

## 13. Open Questions

1. Should we implement a custom PeerJS server or use the public one?
2. What is the maximum file size limit for transfer?
3. Should chat history persist across sessions? If so, encrypted local storage or optional cloud sync?
4. Should we support voice messages?
5. What is the preferred method for handling NAT traversal (STUN/TURN configuration)?

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **P2P** | Peer-to-Peer, direct communication between devices |
| **WebRTC** | Web Real-Time Communication, browser API for P2P |
| **PeerJS** | JavaScript library simplifying WebRTC |
| **AES** | Advanced Encryption Standard |
| **RSA** | Rivest-Shamir-Adleman, public-key cryptosystem |
| **GCM** | Galois/Counter Mode, encryption mode |
| **OAEP** | Optimal Asymmetric Encryption Padding |
| **STUN** | Session Traversal Utilities for NAT |
| **TURN** | Traversal Using Relays around NAT |

---

*Document Version: 1.0.0*
*Last Updated: 2026-08-10*
*Author: P2P Messenger Team*