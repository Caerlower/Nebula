const isLocalHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]'

const local = typeof window !== 'undefined' && isLocalHost(window.location.hostname)

/** Default Hub (mainnet). Local Vite points at the local Hub. */
export const HUB_ORIGIN = local
  ? 'http://localhost:3000'
  : 'https://mainnet.nebulaonchain.xyz'

export const HUB_LOGIN = `${HUB_ORIGIN}/login`

/** Testnet Hub login (always the public testnet host in production). */
export const TESTNET_HUB_LOGIN = local
  ? 'http://localhost:3000/login'
  : 'https://testnet.nebulaonchain.xyz/login'

export const DOCS_URL = 'https://docs.nebulaonchain.xyz'
export const X_URL = 'https://x.com/nebulamcp'
