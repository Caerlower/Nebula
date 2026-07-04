import { motion } from "motion/react";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "p";
};

export function LetterReveal({ text, className = "", delay = 0, as = "h1" }: Props) {
  const Tag = motion[as];
  const words = text.split(" ");
  return (
    <Tag
      className={className}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.025, delayChildren: delay }}
      aria-label={text}
    >
      {words.map((word, wi) => (
        <span
          key={wi}
          className="inline-block whitespace-nowrap"
          style={{ marginRight: "0.28em" }}
        >
          {Array.from(word).map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              variants={{
                hidden: { y: "0.6em", opacity: 0, filter: "blur(12px)" },
                visible: {
                  y: 0,
                  opacity: 1,
                  filter: "blur(0px)",
                  transition: { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] },
                },
              }}
              aria-hidden
            >
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
