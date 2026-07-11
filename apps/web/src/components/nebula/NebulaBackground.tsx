import { motion, useScroll, useTransform } from "motion/react";

/** CSS-only nebula glows with gentle parallax and scroll-linked intensity */
export function NebulaBackground() {
  const { scrollYProgress } = useScroll();
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const orbOpacity = useTransform(scrollYProgress, [0, 0.4, 1], [0.22, 0.28, 0.42]);
  const scrollGlow = useTransform(scrollYProgress, [0.55, 1], [0, 1]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0A0A14]">
      <motion.div className="absolute inset-0" style={{ y: parallaxY }}>
        <motion.div
          className="absolute -top-32 left-[15%] h-[36rem] w-[36rem] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(124, 107, 240, 0.45), transparent 70%)",
            opacity: orbOpacity,
          }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[35%] -right-24 h-[32rem] w-[32rem] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.4), transparent 70%)",
            opacity: useTransform(orbOpacity, (v) => v * 0.85),
          }}
          animate={{ x: [0, -25, 0], y: [0, 25, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] left-[5%] h-[28rem] w-[28rem] rounded-full blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(45, 212, 191, 0.35), transparent 70%)",
            opacity: useTransform(orbOpacity, (v) => v * 0.75),
          }}
          animate={{ x: [0, 20, 0], y: [0, -15, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div
        className="absolute inset-x-0 bottom-0 h-[60vh] blur-[80px]"
        style={{
          opacity: scrollGlow,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124, 107, 240, 0.35), transparent 70%)",
        }}
      />
    </div>
  );
}
