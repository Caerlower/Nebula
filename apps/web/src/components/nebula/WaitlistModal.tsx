import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function WaitlistModal({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setSubmitted(false);
        setEmail("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="glass-strong relative w-full max-w-md rounded-3xl p-8"
            initial={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col gap-5"
                >
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      Join the waitlist
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Be first when Nebula opens up. No spam, ever.
                    </p>
                  </div>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-base outline-none transition focus:border-nebula-purple/60 focus:bg-white/10"
                  />
                  <button
                    type="submit"
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-nebula-purple via-nebula-blue to-nebula-teal px-6 py-3.5 text-base font-medium text-primary-foreground shadow-[0_0_40px_-10px_var(--color-nebula-purple)] transition-transform hover:scale-[1.02]"
                  >
                    Reserve my spot
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  className="flex flex-col items-center gap-5 py-4 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <div className="relative">
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "radial-gradient(closest-side, var(--color-nebula-purple), transparent 70%)",
                      }}
                      animate={{ scale: [0.6, 2.2], opacity: [0.9, 0] }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-nebula-purple via-nebula-blue to-nebula-teal shadow-[0_0_60px_-5px_var(--color-nebula-purple)]">
                      <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
                    </div>
                    {/* particle burst */}
                    {Array.from({ length: 12 }).map((_, i) => {
                      const a = (i / 12) * Math.PI * 2;
                      return (
                        <motion.span
                          key={i}
                          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-nebula-teal"
                          initial={{ x: 0, y: 0, opacity: 1 }}
                          animate={{
                            x: Math.cos(a) * 80,
                            y: Math.sin(a) * 80,
                            opacity: 0,
                          }}
                          transition={{ duration: 0.9, ease: "easeOut" }}
                        />
                      );
                    })}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      You're on the list.
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      We'll email {email} when Nebula is ready.
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="mt-2 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Close
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
