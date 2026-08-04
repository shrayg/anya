"use client";

import clsx from "clsx";
import Link from "next/link";
import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";

import "./specular-button.css";

type ButtonSize = "sm" | "md" | "lg";

export type SpecularButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> & {
  children?: ReactNode;
  size?: ButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  /** Stronger ice-blue fill for primary accents. */
  accent?: boolean;
  /** Render as Next.js Link when set (marketing CTAs). */
  href?: string;
  target?: string;
  rel?: string;
};

interface ShaderProps {
  radius: number;
  lineColor: string;
  baseColor: string;
  intensity: number;
  shineSize: number;
  shineFade: number;
  thickness: number;
  speed: number;
  followMouse: boolean;
  proximity: number;
  autoAnimate: boolean;
}

const PAD = 20;

/** Anya ice-blue defaults — not the purple/neutral React Bits demo. */
const ANYA = {
  tint: "#c3d3e6",
  tintOpacity: 0.12,
  blur: 14,
  textColor: "#f4f7fb",
  lineColor: "#e8f0f8",
  baseColor: "#4a5a6e",
  intensity: 1.15,
  shineSize: 12,
  shineFade: 36,
  thickness: 1.15,
  speed: 0.32,
  proximity: 280,
} as const;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

function useSpecularFx(
  btnRef: React.RefObject<HTMLElement | null>,
  fxRef: React.RefObject<HTMLSpanElement | null>,
  propsRef: React.MutableRefObject<ShaderProps>,
) {
  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      dpr,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const sizeRef = { w: 1, h: 1 };
    const resize = () => {
      const rect = btn.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      sizeRef.w = w;
      sizeRef.h = h;
      renderer.setSize(w + PAD * 2, h + PAD * 2);
      program.uniforms.uCenter.value = [
        (PAD + w / 2) * dpr,
        (PAD + h / 2) * dpr,
      ];
      program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(btn);
    resize();

    let pointerAngle: number | null = null;
    let proximityT = 0;
    let angle = 2.4;
    let idleAngle = 2.4;
    let bright = 0;
    let last = performance.now();
    let raf = 0;
    let looping = false;
    let inView = true;
    let pageVisible = document.visibilityState === "visible";

    /** Keep animating until shine has fully faded when idle. */
    const BRIGHT_EPS = 0.002;

    const lineC = new Color();
    const baseC = new Color();

    const shouldRun = () => {
      if (!pageVisible || !inView) return false;
      const p = propsRef.current;
      // autoAnimate: continuous rim while visible
      if (p.autoAnimate) return true;
      // proximity / residual fade-out only
      return proximityT > BRIGHT_EPS || bright > BRIGHT_EPS;
    };

    const stopLoop = () => {
      if (!looping) return;
      looping = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // function declaration so ensureLoop / observers can call before this block ends
    function update(now: number) {
      if (!shouldRun()) {
        looping = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(update);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = propsRef.current;

      idleAngle += p.speed * dt;
      const steer =
        p.followMouse &&
        pointerAngle != null &&
        (!p.autoAnimate || proximityT > 0);
      const target = steer ? pointerAngle! : idleAngle;
      const diff =
        ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));

      const brightTarget = p.autoAnimate ? 1 : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

      lineC.set(p.lineColor);
      baseC.set(p.baseColor);
      program.uniforms.uAngle.value = angle;
      program.uniforms.uRadius.value =
        Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      program.uniforms.uIntensity.value = p.intensity * bright;
      program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
      program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
      program.uniforms.uThickness.value = p.thickness * dpr;
      renderer.render({ scene: mesh });
    }

    const ensureLoop = () => {
      if (looping || !shouldRun()) return;
      looping = true;
      last = performance.now();
      raf = requestAnimationFrame(update);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2 || 1);
        const ny = (cy - e.clientY) / (rect.height / 2 || 1);
        pointerAngle =
          Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
      // Wake idle (non-autoAnimate) instances when pointer enters proximity
      if (proximityT > BRIGHT_EPS) ensureLoop();
    };
    window.addEventListener("pointermove", onPointerMove);

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView) ensureLoop();
        else stopLoop();
      },
      // Start slightly before fully on-screen so shine is ready
      { root: null, rootMargin: "48px", threshold: 0 },
    );
    io.observe(btn);

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) ensureLoop();
      else stopLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    ensureLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [btnRef, fxRef, propsRef]);
}

export const SpecularButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  SpecularButtonProps
>(function SpecularButton(
  {
    children = "Get Started",
    size = "md",
    radius = 14,
    tint = ANYA.tint,
    tintOpacity = ANYA.tintOpacity,
    blur = ANYA.blur,
    textColor = ANYA.textColor,
    lineColor = ANYA.lineColor,
    baseColor = ANYA.baseColor,
    intensity = ANYA.intensity,
    shineSize = ANYA.shineSize,
    shineFade = ANYA.shineFade,
    thickness = ANYA.thickness,
    speed = ANYA.speed,
    followMouse = true,
    proximity = ANYA.proximity,
    autoAnimate = true,
    accent = false,
    disabled = false,
    onClick,
    className = "",
    type = "button",
    href,
    target,
    rel,
    style,
    ...rest
  },
  ref,
) {
  const btnRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const fxRef = useRef<HTMLSpanElement | null>(null);
  const propsRef = useRef({} as ShaderProps);

  useImperativeHandle(ref, () => btnRef.current as HTMLButtonElement);

  propsRef.current = {
    radius,
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    speed,
    followMouse,
    proximity,
    autoAnimate,
  };

  useSpecularFx(btnRef, fxRef, propsRef);

  const cssVars = {
    ...style,
    "--sb-radius": `${radius}px`,
    "--sb-tint": tint,
    "--sb-tint-opacity": accent
      ? Math.max(tintOpacity, 0.2)
      : tintOpacity,
    "--sb-blur": `${blur}px`,
    "--sb-text-color": textColor,
  } as CSSProperties;

  const classes = clsx(
    "specular-button",
    `specular-button--${size}`,
    accent && "specular-button--accent",
    className,
  );

  const fx = (
    <>
      <span ref={fxRef} aria-hidden className="specular-button__fx" />
      <span className="specular-button__label">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link
        aria-disabled={disabled || undefined}
        className={classes}
        href={href}
        rel={rel}
        style={cssVars}
        tabIndex={disabled ? -1 : undefined}
        target={target}
        onClick={
          disabled
            ? (e) => {
                e.preventDefault();
              }
            : (onClick as
                | React.MouseEventHandler<HTMLAnchorElement>
                | undefined)
        }
        ref={(node) => {
          btnRef.current = node;
        }}
      >
        {fx}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled}
      style={cssVars}
      type={type}
      onClick={onClick}
      ref={(node) => {
        btnRef.current = node;
      }}
      {...rest}
    >
      {fx}
    </button>
  );
});

SpecularButton.displayName = "SpecularButton";

export default SpecularButton;
