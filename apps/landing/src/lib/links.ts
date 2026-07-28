const isLocalHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]'

export const HUB_ORIGIN =
  typeof window !== 'undefined' && isLocalHost(window.location.hostname)
    ? 'http://localhost:3000'
    : 'https://mainnet.nebulaonchain.xyz'

export const HUB_LOGIN = `${HUB_ORIGIN}/login`
export const DOCS_URL = 'https://docs.nebulaonchain.xyz'
export const X_URL = 'https://x.com/nebulamcp'
