import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  index?: number;
  className?: string;
};

export function GlassCard({ children, index = 0, className = "" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.1,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.25 } }}
      className={`group relative ${className}`}
    >
      <div
        aria-hidden
        className="absolute -inset-px rounded-3xl opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(124,107,240,0.35), rgba(59,130,246,0.2), rgba(45,212,191,0.25))",
        }}
      />
      <div className="glass relative h-full rounded-3xl p-8 transition-colors duration-300 group-hover:border-white/20">
        {children}
      </div>
    </motion.div>
  );
}
