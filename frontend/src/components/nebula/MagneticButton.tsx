import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef, type ReactNode, type MouseEvent } from "react";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "ghost";
};

export function MagneticButton({ children, onClick, className = "", variant = "primary" }: Props) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 });

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    x.set(dx * 0.25);
    y.set(dy * 0.35);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const base =
    variant === "primary"
      ? "relative overflow-hidden rounded-full px-8 py-4 text-base font-medium text-primary-foreground bg-gradient-to-r from-nebula-purple via-nebula-blue to-nebula-teal shadow-[0_0_60px_-10px_var(--color-nebula-purple)]"
      : "relative overflow-hidden rounded-full px-8 py-4 text-base font-medium text-foreground border border-white/15";

  return (
    <motion.button
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      className={`${base} ${className} group isolate`}
    >
      {/* pulsing aura */}
      <motion.span
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--color-nebula-purple), transparent 70%)",
        }}
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* shine sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
