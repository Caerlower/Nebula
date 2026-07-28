import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

type WaitlistCtx = {
  submit: (email: string) => void
}

const Ctx = createContext<WaitlistCtx | null>(null)

export function WaitlistProvider({ children }: { children: ReactNode }) {
  const emails = useRef<string[]>([])

  const submit = useCallback((email: string) => {
    emails.current.push(email)
    void fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'landing' }),
    }).catch(() => {})
  }, [])

  const value = useMemo(() => ({ submit }), [submit])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWaitlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWaitlist must be used inside <WaitlistProvider>')
  return ctx
}
