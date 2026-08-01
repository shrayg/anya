"use client";

// Component inspired by github.com/zavalit/bayer-dithering-webgl-demo

import { Effect, EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";

import "./pixel-blast.css";

export type PixelBlastVariant = "square" | "circle" | "triangle" | "diamond";

export interface PixelBlastProps {
  variant?: PixelBlastVariant;
  pixelSize?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  antialias?: boolean;
  patternScale?: number;
  patternDensity?: number;
  liquid?: boolean;
  liquidStrength?: number;
  liquidRadius?: number;
  pixelSizeJitter?: number;
  enableRipples?: boolean;
  rippleIntensityScale?: number;
  rippleThickness?: number;
  rippleSpeed?: number;
  liquidWobbleSpeed?: number;
  autoPauseOffscreen?: boolean;
  speed?: number;
  transparent?: boolean;
  edgeFade?: number;
  noiseAmount?: number;
  /** Freezes the simulation — wire this to `prefers-reduced-motion`. */
  paused?: boolean;
  /**
   * Where ripple/liquid pointer events are read from. Use `"window"` when the
   * canvas sits behind other content that would otherwise swallow the events
   * (e.g. a full-viewport background).
   */
  interactionTarget?: "self" | "window";
}

const SHAPE_MAP: Record<PixelBlastVariant, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3,
};

const MAX_CLICKS = 10;
const TOUCH_SIZE = 64;
const TOUCH_MAX_AGE = 64;
/** Clamps the per-frame step so a backgrounded tab does not resume with a time jump. */
const MAX_FRAME_DELTA = 1 / 20;

type TouchPoint = {
  x: number;
  y: number;
  age: number;
  force: number;
  vx: number;
  vy: number;
};

type TouchTexture = {
  texture: THREE.Texture;
  addTouch: (norm: { x: number; y: number }) => void;
  update: () => void;
  dispose: () => void;
  radiusScale: number;
};

const createTouchTexture = (): TouchTexture | null => {
  const canvas = document.createElement("canvas");

  canvas.width = TOUCH_SIZE;
  canvas.height = TOUCH_SIZE;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const texture = new THREE.Texture(canvas);

  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const trail: TouchPoint[] = [];
  const decay = 1 / TOUCH_MAX_AGE;
  const baseRadius = 0.1 * TOUCH_SIZE;
  let radius = baseRadius;
  let last: { x: number; y: number } | null = null;

  const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);
  const easeOutQuad = (t: number) => -t * (t - 2);

  const clear = () => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, TOUCH_SIZE, TOUCH_SIZE);
  };

  clear();

  const drawPoint = (p: TouchPoint) => {
    const x = p.x * TOUCH_SIZE;
    const y = (1 - p.y) * TOUCH_SIZE;
    const ramp = TOUCH_MAX_AGE * 0.3;
    const intensity =
      (p.age < ramp
        ? easeOutSine(p.age / ramp)
        : easeOutQuad(1 - (p.age - ramp) / (TOUCH_MAX_AGE - ramp)) || 0) *
      p.force;

    // Velocity is packed into R/G and intensity into B for the liquid shader.
    const color = `${((p.vx + 1) / 2) * 255}, ${((p.vy + 1) / 2) * 255}, ${intensity * 255}`;
    // The disc itself is drawn offscreen so only its soft shadow lands on the canvas.
    const offset = TOUCH_SIZE * 5;

    ctx.shadowOffsetX = offset;
    ctx.shadowOffsetY = offset;
    ctx.shadowBlur = radius;
    ctx.shadowColor = `rgba(${color},${0.22 * intensity})`;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,0,0,1)";
    ctx.arc(x - offset, y - offset, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  return {
    texture,
    addTouch(norm) {
      let force = 0;
      let vx = 0;
      let vy = 0;

      if (last) {
        const dx = norm.x - last.x;
        const dy = norm.y - last.y;

        if (dx === 0 && dy === 0) return;
        const dd = dx * dx + dy * dy;
        const d = Math.sqrt(dd) || 1;

        vx = dx / d;
        vy = dy / d;
        force = Math.min(dd * 10000, 1);
      }
      last = { x: norm.x, y: norm.y };
      trail.push({ x: norm.x, y: norm.y, age: 0, force, vx, vy });
    },
    update() {
      clear();
      for (let i = trail.length - 1; i >= 0; i--) {
        const point = trail[i];
        const f = point.force * decay * (1 - point.age / TOUCH_MAX_AGE);

        point.x += point.vx * f;
        point.y += point.vy * f;
        point.age++;
        if (point.age > TOUCH_MAX_AGE) trail.splice(i, 1);
      }
      for (const point of trail) drawPoint(point);
      texture.needsUpdate = true;
    },
    dispose() {
      trail.length = 0;
      texture.dispose();
    },
    get radiusScale() {
      return radius / baseRadius;
    },
    set radiusScale(value: number) {
      radius = baseRadius * value;
    },
  };
};

const LIQUID_FRAGMENT = `
uniform sampler2D uTexture;
uniform float uStrength;
uniform float uTime;
uniform float uFreq;

void mainUv(inout vec2 uv) {
  vec4 tex = texture2D(uTexture, uv);
  float vx = tex.r * 2.0 - 1.0;
  float vy = tex.g * 2.0 - 1.0;
  float intensity = tex.b;
  float wave = 0.5 + 0.5 * sin(uTime * uFreq + intensity * 6.2831853);
  uv += vec2(vx, vy) * (uStrength * intensity * wave);
}
`;

const NOISE_FRAGMENT = `
uniform float uTime;
uniform float uAmount;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float n = hash(floor(uv * vec2(1920.0, 1080.0)) + floor(uTime * 60.0));
  outputColor = inputColor + vec4(vec3((n - 0.5) * uAmount), 0.0);
}
`;

const VERTEX_SRC = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;

uniform int   uShapeType;
const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  vec3 color = uColor;

  vec3 srgbColor = mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, color)
  );

  fragColor = vec4(srgbColor, M);
}
`;

type PixelBlastUniforms = {
  uResolution: { value: THREE.Vector2 };
  uTime: { value: number };
  uColor: { value: THREE.Color };
  uClickPos: { value: THREE.Vector2[] };
  uClickTimes: { value: Float32Array };
  uShapeType: { value: number };
  uPixelSize: { value: number };
  uScale: { value: number };
  uDensity: { value: number };
  uPixelJitter: { value: number };
  uEnableRipples: { value: number };
  uRippleSpeed: { value: number };
  uRippleThickness: { value: number };
  uRippleIntensity: { value: number };
  uEdgeFade: { value: number };
};

type PixelBlastInstance = {
  renderer: THREE.WebGLRenderer;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  uniforms: PixelBlastUniforms;
  composer: EffectComposer | null;
  touch: TouchTexture | null;
  liquidEffect: Effect | null;
  clickIx: number;
  /** Queues a single frame so a paused/idle background still repaints. */
  requestRender: () => void;
};

const randomFloat = () => {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);

    window.crypto.getRandomValues(buf);

    return buf[0] / 0xffffffff;
  }

  return Math.random();
};

const PixelBlast = ({
  variant = "square",
  pixelSize = 4,
  color = "#B497CF",
  className,
  style,
  antialias = true,
  patternScale = 2,
  patternDensity = 1,
  liquid = false,
  liquidStrength = 0.1,
  liquidRadius = 1,
  pixelSizeJitter = 0,
  enableRipples = true,
  rippleIntensityScale = 1,
  rippleThickness = 0.1,
  rippleSpeed = 0.3,
  liquidWobbleSpeed = 4.5,
  autoPauseOffscreen = true,
  speed = 0.5,
  transparent = true,
  edgeFade = 0.25,
  noiseAmount = 0,
  paused = false,
  interactionTarget = "self",
}: PixelBlastProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<PixelBlastInstance | null>(null);

  // Read by the render loop and by the one-shot initialiser so that neither has to
  // re-run when a purely cosmetic prop changes.
  const configRef = useRef({
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    liquidStrength,
    liquidRadius,
    pixelSizeJitter,
    enableRipples,
    rippleIntensityScale,
    rippleThickness,
    rippleSpeed,
    liquidWobbleSpeed,
    speed,
    transparent,
    edgeFade,
    paused,
  });

  configRef.current = {
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    liquidStrength,
    liquidRadius,
    pixelSizeJitter,
    enableRipples,
    rippleIntensityScale,
    rippleThickness,
    rippleSpeed,
    liquidWobbleSpeed,
    speed,
    transparent,
    edgeFade,
    paused,
  };

  // Only structural options rebuild the WebGL pipeline; everything else is a uniform write.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const cfg = configRef.current;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: document.createElement("canvas"),
        antialias,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // No WebGL2 — the surrounding layout keeps its flat background.
      return;
    }

    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    if (cfg.transparent) renderer.setClearAlpha(0);
    else renderer.setClearColor(0x000000, 1);

    const uniforms: PixelBlastUniforms = {
      uResolution: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(cfg.color) },
      uClickPos: {
        value: Array.from(
          { length: MAX_CLICKS },
          () => new THREE.Vector2(-1, -1),
        ),
      },
      uClickTimes: { value: new Float32Array(MAX_CLICKS) },
      uShapeType: { value: SHAPE_MAP[cfg.variant] ?? 0 },
      uPixelSize: { value: cfg.pixelSize * renderer.getPixelRatio() },
      uScale: { value: cfg.patternScale },
      uDensity: { value: cfg.patternDensity },
      uPixelJitter: { value: cfg.pixelSizeJitter },
      uEnableRipples: { value: cfg.enableRipples ? 1 : 0 },
      uRippleSpeed: { value: cfg.rippleSpeed },
      uRippleThickness: { value: cfg.rippleThickness },
      uRippleIntensity: { value: cfg.rippleIntensityScale },
      uEdgeFade: { value: cfg.edgeFade },
    };

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SRC,
      fragmentShader: FRAGMENT_SRC,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      glslVersion: THREE.GLSL3,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);

    scene.add(new THREE.Mesh(geometry, material));

    let composer: EffectComposer | null = null;
    let touch: TouchTexture | null = null;
    let liquidEffect: Effect | null = null;
    const timedEffects: Effect[] = [];

    if (liquid) {
      touch = createTouchTexture();
      if (touch) {
        touch.radiusScale = cfg.liquidRadius;
        liquidEffect = new Effect("LiquidEffect", LIQUID_FRAGMENT, {
          uniforms: new Map<string, THREE.Uniform>([
            ["uTexture", new THREE.Uniform(touch.texture)],
            ["uStrength", new THREE.Uniform(cfg.liquidStrength)],
            ["uTime", new THREE.Uniform(0)],
            ["uFreq", new THREE.Uniform(cfg.liquidWobbleSpeed)],
          ]),
        });
        timedEffects.push(liquidEffect);
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new EffectPass(camera, liquidEffect));
      }
    }

    if (noiseAmount > 0) {
      const noiseEffect = new Effect("NoiseEffect", NOISE_FRAGMENT, {
        uniforms: new Map<string, THREE.Uniform>([
          ["uTime", new THREE.Uniform(0)],
          ["uAmount", new THREE.Uniform(noiseAmount)],
        ]),
      });

      timedEffects.push(noiseEffect);
      if (!composer) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
      }
      composer.addPass(new EffectPass(camera, noiseEffect));
    }

    // Ensures an idle background (reduced motion, offscreen, hidden tab) still
    // paints one static frame instead of staying blank.
    let dirty = true;
    const requestRender = () => {
      dirty = true;
    };

    const setSize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;

      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height,
      );
      uniforms.uPixelSize.value =
        configRef.current.pixelSize * renderer.getPixelRatio();
      composer?.setSize(renderer.domElement.width, renderer.domElement.height);
      requestRender();
    };

    setSize();

    const resizeObserver = new ResizeObserver(setSize);

    resizeObserver.observe(container);

    const mapToPixels = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const w = renderer.domElement.width;
      const h = renderer.domElement.height;

      return {
        fx: (event.clientX - rect.left) * (w / rect.width),
        fy: (rect.height - (event.clientY - rect.top)) * (h / rect.height),
        w,
        h,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!configRef.current.enableRipples) return;
      const instance = instanceRef.current;

      if (!instance) return;
      const { fx, fy } = mapToPixels(event);
      const ix = instance.clickIx;

      uniforms.uClickPos.value[ix].set(fx, fy);
      uniforms.uClickTimes.value[ix] = uniforms.uTime.value;
      instance.clickIx = (ix + 1) % MAX_CLICKS;
      requestRender();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!touch) return;
      const { fx, fy, w, h } = mapToPixels(event);

      touch.addTouch({ x: fx / w, y: fy / h });
    };

    const pointerSource: HTMLElement | Window =
      interactionTarget === "window" ? window : renderer.domElement;

    pointerSource.addEventListener(
      "pointerdown",
      onPointerDown as EventListener,
      {
        passive: true,
      },
    );
    pointerSource.addEventListener(
      "pointermove",
      onPointerMove as EventListener,
      {
        passive: true,
      },
    );

    let onScreen = true;
    const intersectionObserver = autoPauseOffscreen
      ? new IntersectionObserver((entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting);
        })
      : null;

    intersectionObserver?.observe(container);

    let tabVisible = !document.hidden;
    const onVisibilityChange = () => {
      tabVisible = !document.hidden;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const clock = new THREE.Clock();
    // Accumulating scaled deltas keeps `speed` changes continuous instead of
    // rescaling the whole elapsed time and jumping the pattern.
    let elapsed = randomFloat() * 1000;
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), MAX_FRAME_DELTA);
      const idle = configRef.current.paused || !tabVisible || !onScreen;

      if (idle && !dirty) return;

      if (!idle) {
        elapsed += delta * configRef.current.speed;
      }

      uniforms.uTime.value = elapsed;
      for (const effect of timedEffects) {
        const uTime = effect.uniforms.get("uTime");

        if (uTime) uTime.value = elapsed;
      }

      if (composer) {
        touch?.update();
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      dirty = false;
    };

    raf = requestAnimationFrame(animate);

    instanceRef.current = {
      renderer,
      material,
      geometry,
      uniforms,
      composer,
      touch,
      liquidEffect,
      clickIx: 0,
      requestRender,
    };

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      pointerSource.removeEventListener(
        "pointerdown",
        onPointerDown as EventListener,
      );
      pointerSource.removeEventListener(
        "pointermove",
        onPointerMove as EventListener,
      );
      touch?.dispose();
      composer?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      instanceRef.current = null;
    };
  }, [antialias, liquid, noiseAmount, autoPauseOffscreen, interactionTarget]);

  useEffect(() => {
    const instance = instanceRef.current;

    if (!instance) return;
    const { uniforms, renderer } = instance;

    uniforms.uShapeType.value = SHAPE_MAP[variant] ?? 0;
    uniforms.uPixelSize.value = pixelSize * renderer.getPixelRatio();
    uniforms.uColor.value.set(color);
    uniforms.uScale.value = patternScale;
    uniforms.uDensity.value = patternDensity;
    uniforms.uPixelJitter.value = pixelSizeJitter;
    uniforms.uEnableRipples.value = enableRipples ? 1 : 0;
    uniforms.uRippleIntensity.value = rippleIntensityScale;
    uniforms.uRippleThickness.value = rippleThickness;
    uniforms.uRippleSpeed.value = rippleSpeed;
    uniforms.uEdgeFade.value = edgeFade;
    if (transparent) renderer.setClearAlpha(0);
    else renderer.setClearColor(0x000000, 1);
    if (instance.liquidEffect) {
      const uStrength = instance.liquidEffect.uniforms.get("uStrength");

      if (uStrength) uStrength.value = liquidStrength;
      const uFreq = instance.liquidEffect.uniforms.get("uFreq");

      if (uFreq) uFreq.value = liquidWobbleSpeed;
    }
    if (instance.touch) instance.touch.radiusScale = liquidRadius;
    instance.requestRender();
  }, [
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    pixelSizeJitter,
    enableRipples,
    rippleIntensityScale,
    rippleThickness,
    rippleSpeed,
    edgeFade,
    transparent,
    liquidStrength,
    liquidRadius,
    liquidWobbleSpeed,
  ]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`pixel-blast-container ${className ?? ""}`}
      style={style}
    />
  );
};

export default PixelBlast;
