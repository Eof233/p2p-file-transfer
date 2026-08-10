# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn start          # Dev server (react-scripts start)
yarn build          # Production build
yarn test           # Run tests
yarn deploy         # Build + deploy to GitHub Pages (gh-pages)
```

## Architecture

Browser-based P2P file transfer app. React 18 + TypeScript, bundled with Create React App.

**Core flow:** Peer A starts a session → gets a unique PeerJS ID → shares it → Peer B connects by ID → bidirectional data channel opens → files transfer as Blobs over WebRTC.

### Key Layers

**`src/helpers/peer.ts`** — The P2P engine. Wraps PeerJS with a singleton `PeerConnection` object that owns:
- `connectionMap: Map<string, DataConnection>` — all active connections
- Promise-based API for session lifecycle (`startPeerSession`, `closePeerSession`, `connectPeer`)
- Event registration for incoming data and disconnections
- Data protocol: `Data { dataType: DataType, file?, fileName?, fileType?, message? }`

**`src/store/`** — Redux Toolkit store with two slices:
- `peer` — session state (id, loading, started)
- `connection` — connection list, selection, and input state

Async actions are hand-written thunks (not `createAsyncThunk`) that call `PeerConnection` methods and dispatch plain action objects. Action types are string enums in `*Types.ts` files.

**`src/App.tsx`** — Single-page UI. Renders peer session controls, connection input, connection list, and file upload. All state flows through `useAppSelector`/`useAppDispatch` hooks.

### Important Patterns

- **File reception** auto-downloads via `js-file-download` — no confirmation dialog currently.
- **PeerJS config** uses default public server (no custom host). The `runtimeConfig.ts` exposes `window.runtimeConfigs` for environment-specific overrides, but it's unused by PeerJS today.
- **Ant Design 5** is the UI framework — all imports come from `antd` and `@ant-design/icons`.
- **No routing** — single-component architecture.
- **No backend** — purely client-side; the only external dependency is PeerJS's signaling server.
