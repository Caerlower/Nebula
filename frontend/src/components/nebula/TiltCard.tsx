import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; index?: number; className?: string };

export function TiltCard({ children, index = 0, className = "" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: 18, rotateY: -6 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 1, ease: [0.2, 0.7, 0.2, 1], delay: index * 0.12 }}
      style={{ transformPerspective: 1200 }}
      className={`relative group ${className}`}
    >
      <div
        aria-hidden
        className="absolute -inset-1 rounded-3xl opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-80"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-nebula-purple) 60%, transparent), transparent 70%)",
        }}
      />
      <div className="relative glass rounded-3xl p-8 h-full">{children}</div>
    </motion.div>
  );
}
