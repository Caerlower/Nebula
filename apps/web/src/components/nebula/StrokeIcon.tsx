import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; delay?: number };

export function StrokeIcon({ children, delay = 0 }: Props) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="h-10 w-10 text-nebula-teal"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ staggerChildren: 0.15, delayChildren: delay }}
    >
      {children}
    </motion.svg>
  );
}

import type { Variants } from "motion/react";

export const drawVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.2, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.2 },
    },
  },
};
