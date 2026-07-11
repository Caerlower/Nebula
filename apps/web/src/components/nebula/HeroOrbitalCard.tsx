import { motion } from "motion/react";
import { Shield, Wallet, Zap } from "lucide-react";

/** Subtle floating glass card hinting at wallet + policy + payments */
export function HeroOrbitalCard() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute right-[8%] top-[22%] hidden w-56 lg:block xl:right-[14%] xl:w-64"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <motion.div
        className="glass-strong rounded-2xl p-5 shadow-[0_0_60px_-20px_rgba(124,107,240,0.5)]"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF] shadow-[0_0_8px_#2DD4BF]" />
          Agent wallet · active
        </div>
        <div className="space-y-3">
          {[
            { icon: Wallet, label: "Balance", value: "124.50 XLM" },
            { icon: Shield, label: "Policy", value: "20 / day cap" },
            { icon: Zap, label: "Yield", value: "Blend · 4.2%" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
            >
              <div className="flex items-center gap-2 text-xs text-white/45">
                <row.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {row.label}
              </div>
              <span className="text-xs font-medium text-white/80">{row.value}</span>
            </div>
          ))}
        </div>
      </motion.div>
      {/* orbital ring */}
      <motion.div
        className="absolute -inset-8 rounded-full border border-white/[0.04]"
        animate={{ rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}
