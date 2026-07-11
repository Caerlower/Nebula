import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type WaitlistCtx = {
  isOpen: boolean
  open: () => void
  close: () => void
  submit: (email: string) => void
}

const Ctx = createContext<WaitlistCtx | null>(null)

export function WaitlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  // Local copy for this session; the source of truth is the app's API.
  const emails = useRef<string[]>([])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const submit = useCallback((email: string) => {
    emails.current.push(email)
    // Served same-origin by the Next.js app in production; in standalone
    // vite dev there is no API, so failures stay silent by design.
    void fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'landing' }),
    }).catch(() => {})
  }, [])

  const value = useMemo(
    () => ({ isOpen, open, close, submit }),
    [isOpen, open, close, submit],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWaitlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWaitlist must be used inside <WaitlistProvider>')
  return ctx
}
