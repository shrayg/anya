"use client";

import { useEffect, useId, useRef, useState } from "react";

type IntelSignalLoaderProps = {
  active: boolean;
  /** Module name shown under the bar, e.g. "Instagram" */
  title?: string;
  /** Line under the title — defaults to "Assembling live graph" */
  stage?: string;
  variant?: "hero" | "compact";
  className?: string;
};

/**
 * Centered wireframe torus + percent, with bar and copy underneath.
 */
export function IntelSignalLoader({
  active,
  title = "Module",
  stage = "Assembling live graph",
  variant = "hero",
  className = "",
}: IntelSignalLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRafRef = useRef<number | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const labelId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!active) {
      progressRef.current = 0;
      setProgress(0);
      startRef.current = 0;
      if (progressRafRef.current != null) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
      return;
    }

    startRef.current = performance.now();
    let alive = true;
    let lastUi = 0;

    const tick = (now: number) => {
      if (!alive) return;
      const elapsed = (now - startRef.current) / 1000;
      const next = Math.min(0.94, 1 - Math.exp(-elapsed / 9.5));
      progressRef.current = next;
      if (now - lastUi > 80) {
        lastUi = now;
        setProgress(next);
      }
      progressRafRef.current = requestAnimationFrame(tick);
    };

    progressRafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (progressRafRef.current != null) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let alive = true;
    const majorSegs = variant === "compact" ? 36 : 48;
    const minorSegs = variant === "compact" ? 12 : 16;
    const R0 = 1.05;
    const r0 = 0.38;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const css = canvas.clientWidth || (variant === "compact" ? 120 : 220);
      canvas.width = Math.floor(css * dpr);
      canvas.height = Math.floor(css * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type Pt = { x: number; y: number; z: number; sx: number; sy: number };
    const project = (x: number, y: number, z: number, size: number): Pt => {
      const scale = size * 0.3;
      const persp = 2.6 / (2.6 + z);
      return {
        x,
        y,
        z,
        sx: size / 2 + x * scale * persp,
        sy: size / 2 + y * scale * persp * 0.92,
      };
    };

    const pointAt = (i: number, j: number, t: number, size: number): Pt => {
      const u = (i / majorSegs) * Math.PI * 2;
      const v = (j / minorSegs) * Math.PI * 2;
      const wave =
        Math.sin(u * 3 + t * 1.1) * 0.16 +
        Math.sin(v * 2 - t * 1.35) * 0.09 +
        Math.sin(u * 5 - v * 2 + t * 0.7) * 0.05;
      const R = R0 + wave;
      const r = r0 + wave * 0.28;
      const x = (R + r * Math.cos(v)) * Math.cos(u);
      const y = (R + r * Math.cos(v)) * Math.sin(u);
      const z = r * Math.sin(v);

      const ax = 0.55 + Math.sin(t * 0.35) * 0.08;
      const ay = t * 0.42;
      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      const x2 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;
      return project(x2, y1, z2, size);
    };

    const draw = (now: number) => {
      if (!alive) return;
      const size = canvas.clientWidth || 220;
      const t = reducedMotion ? 0.8 : now / 1000;
      const pct = progressRef.current;
      ctx.clearRect(0, 0, size, size);

      const bloom = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.08,
        size / 2,
        size / 2,
        size * 0.48,
      );
      bloom.addColorStop(0, "rgba(240, 164, 184, 0.12)");
      bloom.addColorStop(0.45, "rgba(255, 255, 255, 0.03)");
      bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, size, size);

      const grid: Pt[][] = [];
      for (let i = 0; i <= majorSegs; i++) {
        const ring: Pt[] = [];
        for (let j = 0; j <= minorSegs; j++) {
          ring.push(pointAt(i % majorSegs, j % minorSegs, t, size));
        }
        grid.push(ring);
      }

      const strokeSeg = (a: Pt, b: Pt) => {
        const z = (a.z + b.z) * 0.5;
        const depth = Math.max(0.12, Math.min(1, (z + 1.4) / 2.6));
        const blushMix = 0.35 + depth * 0.4;
        ctx.strokeStyle = `rgba(${Math.round(220 + blushMix * 35)}, ${Math.round(190 + depth * 40)}, ${Math.round(200 + depth * 30)}, ${0.12 + depth * 0.55})`;
        ctx.lineWidth = 0.6 + depth * 0.9;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      };

      for (let i = 0; i < majorSegs; i++) {
        for (let j = 0; j < minorSegs; j++) {
          strokeSeg(grid[i][j], grid[i][j + 1]);
        }
      }
      for (let j = 0; j < minorSegs; j++) {
        for (let i = 0; i < majorSegs; i++) {
          strokeSeg(grid[i][j], grid[i + 1][j]);
        }
      }

      if (!reducedMotion) {
        const sweep = (t * 0.9) % (Math.PI * 2);
        for (let k = 0; k < 14; k++) {
          const i =
            Math.floor(((sweep + k * 0.08) / (Math.PI * 2)) * majorSegs) %
            majorSegs;
          const j = Math.floor(minorSegs * 0.35);
          const a = grid[i][j];
          const b = grid[(i + 1) % majorSegs][j];
          ctx.strokeStyle = `rgba(240, 164, 184, ${0.55 - k * 0.035})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }

      const ringR = size * 0.42;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const start = -Math.PI / 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, ringR, start, start + pct * Math.PI * 2);
      ctx.strokeStyle = "rgba(240, 164, 184, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.stroke();

      if (reducedMotion) return;
      drawRafRef.current = requestAnimationFrame(draw);
    };

    drawRafRef.current = requestAnimationFrame(draw);

    return () => {
      alive = false;
      ro.disconnect();
      if (drawRafRef.current != null) {
        cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = null;
      }
    };
  }, [active, reducedMotion, variant]);

  if (!active) return null;

  const pctLabel = `${Math.round(progress * 100)}%`;

  return (
    <div
      aria-busy="true"
      aria-labelledby={labelId}
      className={`intel-signal-loader intel-signal-loader--${variant} ${className}`.trim()}
      role="status"
    >
      <div className="intel-signal-loader__stack">
        <div className="intel-signal-loader__canvas-wrap">
          <canvas
            aria-hidden
            className="intel-signal-loader__canvas"
            ref={canvasRef}
          />
          <div aria-hidden className="intel-signal-loader__pct">
            {pctLabel}
          </div>
        </div>

        <div aria-hidden className="intel-signal-loader__track">
          <div
            className="intel-signal-loader__fill"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>

        <div className="intel-signal-loader__copy">
          <p className="intel-signal-loader__eyebrow" id={labelId}>
            {title}
          </p>
          <p className="intel-signal-loader__stage-text">{stage}</p>
        </div>
      </div>
    </div>
  );
}
