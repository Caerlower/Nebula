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
  // In-memory only, by design. Resets on refresh — wire to a backend later.
  const emails = useRef<string[]>([])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const submit = useCallback((email: string) => {
    emails.current.push(email)
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
