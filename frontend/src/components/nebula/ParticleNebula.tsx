import { useEffect, useRef } from "react";

type Props = {
  className?: string;
  intensity?: number; // 0.5 - 1.5
};

type P = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  delay: number;
  hue: number;
  pulse: number;
  pulsePhase: number;
};

export function ParticleNebula({ className, intensity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = Math.round((isMobile ? 70 : 180) * intensity);
    const linkDist = isMobile ? 90 : 130;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const particles: P[] = [];
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      particles.length = 0;
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * Math.min(width, height) * 0.42;
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + Math.sin(angle) * radius * 0.75;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: Math.random(),
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          baseX: bx,
          baseY: by,
          delay: Math.random() * 900,
          hue: 250 + Math.random() * 80, // purple → teal
          pulse: Math.random() < 0.08 ? 1 : 0,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    resize();
    init();

    const ro = new ResizeObserver(() => {
      resize();
      init();
    });
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      if (isMobile) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const onLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    const render = (now: number) => {
      const t = now - start;
      const introDur = 1600;
      ctx.clearRect(0, 0, width, height);

      const breathe = 1 + Math.sin(t * 0.0004) * 0.03;
      const rot = t * 0.00003;
      const cx = width / 2;
      const cy = height / 2;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      // update positions
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const introT = Math.min(1, Math.max(0, (t - p.delay) / introDur));
        const eased = 1 - Math.pow(1 - introT, 3);

        // orbital target with rotation + breathing
        const dx0 = p.baseX - cx;
        const dy0 = p.baseY - cy;
        const rx = (dx0 * cosR - dy0 * sinR) * breathe + cx;
        const ry = (dx0 * sinR + dy0 * cosR) * breathe + cy;

        if (introT < 1) {
          p.x = p.x + (rx - p.x) * (0.02 + eased * 0.06);
          p.y = p.y + (ry - p.y) * (0.02 + eased * 0.06);
        } else {
          // ambient drift toward target
          p.x += (rx - p.x) * 0.015 + p.vx;
          p.y += (ry - p.y) * 0.015 + p.vy;
          p.vx += (Math.random() - 0.5) * 0.02;
          p.vy += (Math.random() - 0.5) * 0.02;
          p.vx *= 0.94;
          p.vy *= 0.94;
        }

        // cursor gravity
        if (!reduced && mouseRef.current.active) {
          const mdx = mouseRef.current.x - p.x;
          const mdy = mouseRef.current.y - p.y;
          const md2 = mdx * mdx + mdy * mdy;
          const r = 180;
          if (md2 < r * r) {
            const md = Math.sqrt(md2) || 1;
            const f = (1 - md / r) * 0.9;
            p.x += (mdx / md) * f;
            p.y += (mdy / md) * f;
          }
        }
      }

      // draw connection lines
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const d = Math.sqrt(d2);
            const alpha = (1 - d / linkDist) * 0.18;
            ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 90%, 70%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const introT = Math.min(1, Math.max(0, (t - p.delay) / introDur));
        const pulseBoost = p.pulse
          ? 0.5 + 0.5 * Math.sin(t * 0.002 + p.pulsePhase)
          : 0;
        const size = (0.6 + p.z * 1.8) * (1 + pulseBoost * 1.4);

        // cursor brightness
        let bright = 0.55 + p.z * 0.4;
        if (!reduced && mouseRef.current.active) {
          const mdx = mouseRef.current.x - p.x;
          const mdy = mouseRef.current.y - p.y;
          const md2 = mdx * mdx + mdy * mdy;
          if (md2 < 200 * 200) {
            bright = Math.min(1, bright + (1 - Math.sqrt(md2) / 200) * 0.6);
          }
        }
        const alpha = bright * introT;

        // glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 6);
        grad.addColorStop(0, `hsla(${p.hue}, 95%, 75%, ${alpha})`);
        grad.addColorStop(1, `hsla(${p.hue}, 95%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${p.hue}, 100%, 88%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden
    />
  );
}
