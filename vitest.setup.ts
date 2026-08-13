// Minimal browser shims for unit tests running under Node.
// Modules like logService touch `window`/`localStorage` at import time;
// the crypto services rely on Web Crypto, which Node exposes as
// globalThis.crypto.
const g = globalThis as any

if (typeof g.window === 'undefined') {
  g.window = {
    crypto: g.crypto,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

if (typeof g.localStorage === 'undefined') {
  g.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }
}
