import { useEffect, useRef } from "react";

type Spark = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isTouch = window.matchMedia("(hover: none)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const sparks: Spark[] = [];
    let lastX = 0;
    let lastY = 0;
    let acc = 0;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      acc += Math.hypot(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
      if (acc > 8) {
        acc = 0;
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4 - 0.2,
          life: 1,
          hue: 240 + Math.random() * 80,
        });
        if (sparks.length > 120) sparks.shift();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= 0.02;
        s.x += s.vx;
        s.y += s.vy;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const a = s.life * 0.8;
        const size = 1.2 + s.life * 1.5;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size * 5);
        g.addColorStop(0, `hsla(${s.hue}, 100%, 80%, ${a})`);
        g.addColorStop(1, `hsla(${s.hue}, 100%, 60%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 60,
        mixBlendMode: "screen",
      }}
    />
  );
}
