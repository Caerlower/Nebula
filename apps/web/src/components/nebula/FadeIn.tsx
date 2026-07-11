import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "p" | "h2";
} & Pick<HTMLMotionProps<"div">, "id">;

export function FadeIn({
  children,
  className = "",
  delay = 0,
  as = "div",
  ...rest
}: Props) {
  const Tag = motion[as];

  return (
    <Tag
      {...rest}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 0.61, 0.36, 1] }}
      className={className}
    >
      {children}
    </Tag>
  );
}
