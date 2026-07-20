"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

type VoxelPoint = { x: number; y: number; z: number };

type IdentityPixel = Point & {
  homeX: number;
  homeY: number;
  velocityX: number;
  velocityY: number;
  size: number;
  seed: number;
  accent: boolean;
  male: VoxelPoint;
  female: VoxelPoint;
  depth: number;
};

type IdentityLink = {
  accent: boolean;
  from: number;
  to: number;
};

type HeadMesh = {
  links: IdentityLink[];
  pixels: IdentityPixel[];
};

const signalNodes = [
  { x: 0.08, y: 0.31, label: "EMAIL", live: true },
  { x: 0.25, y: 0.12, label: "ALIAS", live: false },
  { x: 0.18, y: 0.75, label: "BREACH", live: true },
  { x: 0.43, y: 0.37, label: "DOMAIN", live: false },
  { x: 0.49, y: 0.88, label: "NETWORK", live: false },
  { x: 0.81, y: 0.17, label: "PLATFORM", live: true },
  { x: 0.93, y: 0.73, label: "ASSET", live: false },
  { x: 0.91, y: 0.38, label: "RECORD", live: false },
] as const;

const identityAnchors = [
  { x: -29, y: -9 },
  { x: -18, y: -24 },
  { x: -27, y: 12 },
  { x: -30, y: -2 },
  { x: -8, y: 29 },
  { x: 19, y: -23 },
  { x: 27, y: 12 },
  { x: 30, y: -3 },
] as const;

function deterministicNoise(value: number) {
  const noise = Math.sin(value * 12.9898) * 43758.5453;

  return noise - Math.floor(noise);
}

function makeIdentityPixels(center: Point, height: number): HeadMesh {
  const scale = Math.max(0.76, Math.min(1.12, height / 620));
  const pixels: IdentityPixel[] = [];
  const links: IdentityLink[] = [];
  const rings = [
    { y: -74, x: 11, z: 11, type: "head" },
    { y: -70, x: 23, z: 22, type: "head" },
    { y: -63, x: 33, z: 31, type: "head" },
    { y: -54, x: 40, z: 37, type: "head" },
    { y: -43, x: 44, z: 41, type: "head" },
    { y: -31, x: 45, z: 43, type: "head" },
    { y: -19, x: 44, z: 42, type: "head" },
    { y: -7, x: 43, z: 41, type: "head" },
    { y: 5, x: 41, z: 39, type: "head" },
    { y: 17, x: 39, z: 36, type: "head" },
    { y: 28, x: 36, z: 33, type: "head" },
    { y: 38, x: 32, z: 29, type: "head" },
    { y: 46, x: 24, z: 23, type: "head" },
    { y: 53, x: 18, z: 19, type: "neck" },
    { y: 66, x: 19, z: 20, type: "neck" },
    { y: 79, x: 23, z: 22, type: "neck" },
    { y: 91, x: 37, z: 25, type: "shoulder" },
    { y: 103, x: 62, z: 28, type: "shoulder" },
    { y: 115, x: 88, z: 30, type: "shoulder" },
    { y: 126, x: 109, z: 32, type: "shoulder" },
  ] as const;
  const segmentCount = 34;
  const ringIndexes: number[][] = [];
  let index = 0;

  const addPixel = (
    male: VoxelPoint,
    female: VoxelPoint,
    seed: number,
    accent = false,
  ) => {
    const homeX = center.x + male.x * scale;
    const homeY = center.y + male.y * scale;
    const pixelIndex = pixels.length;

    const surfaceAccent =
      deterministicNoise(seed * 911 + pixelIndex * 0.618) > 0.845;

    pixels.push({
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      velocityX: 0,
      velocityY: 0,
      size: Math.max(1.15, 1.75 * scale) * (seed > 0.9 ? 1.3 : 1),
      seed,
      accent: accent || surfaceAccent,
      male,
      female,
      depth: male.z,
    });

    return pixelIndex;
  };

  const gaussian = (value: number, centerValue: number, spread: number) =>
    Math.exp(-((value - centerValue) ** 2) / (2 * spread ** 2));

  rings.forEach((ring, ringIndex) => {
    const row: number[] = [];

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const angle = (segment / segmentCount) * Math.PI * 2;
      const seed = deterministicNoise(index * 0.73 + ringIndex * 1.31);
      const front = Math.cos(angle);
      const frontMask = Math.max(0, Math.min(1, (front - 0.28) / 0.72)) ** 3.4;
      const side = Math.sin(angle);
      const isHead = ring.type === "head";
      const jawTaper = isHead && ring.y > 10 ? 1 - (ring.y - 10) * 0.0024 : 1;
      const femaleJawTaper =
        isHead && ring.y > 2 ? 0.96 - (ring.y - 2) * 0.0042 : 0.97;
      const femaleWidth = isHead
        ? femaleJawTaper
        : ring.type === "neck"
          ? 0.78
          : 0.9;
      const maleProfile = isHead
        ? gaussian(ring.y, 5, 7.2) * 18 +
          gaussian(ring.y, 22, 7) * 3.4 +
          gaussian(ring.y, 39, 6) * 3.8 -
          gaussian(ring.y, -14, 8) * 1.8
        : 0;
      const femaleProfile = isHead
        ? gaussian(ring.y, 5, 7) * 13 +
          gaussian(ring.y, 21, 7) * 3 +
          gaussian(ring.y, 38, 6) * 2.6 -
          gaussian(ring.y, -14, 8) * 1.4
        : 0;

      index += 1;
      const male: VoxelPoint = {
        x: side * ring.x * jawTaper,
        y: ring.y,
        z: front * ring.z + frontMask * maleProfile,
      };
      const female: VoxelPoint = {
        x: side * ring.x * femaleWidth,
        y: ring.y - (isHead ? 1.5 : 0),
        z:
          front * ring.z * (isHead ? 0.94 : ring.type === "neck" ? 0.8 : 0.88) +
          frontMask * femaleProfile,
      };

      // Form 02 keeps the same anatomy and grows a restrained rear hair shell.
      if (isHead && (front < 0.18 || Math.abs(side) > 0.9)) {
        const rearWeight = Math.max(0, (0.28 - front) / 1.28);
        const sideWeight = Math.max(0, (Math.abs(side) - 0.84) / 0.16);
        const hairWeight = Math.max(rearWeight, sideWeight);
        const lowerHead = Math.max(0, Math.min(1, (ring.y + 24) / 70));

        female.x *= 1 + hairWeight * 0.1;
        female.z -= rearWeight * (6 + lowerHead * 5);
        female.y += hairWeight * lowerHead * 24;
      }

      row.push(addPixel(male, female, seed, seed > 0.965));
    }

    ringIndexes.push(row);

    row.forEach((pixelIndex, segment) => {
      links.push({
        from: pixelIndex,
        to: row[(segment + 1) % segmentCount],
        accent: deterministicNoise(ringIndex * 37 + segment * 11.3) > 0.955,
      });

      if (ringIndex > 0) {
        links.push({
          from: ringIndexes[ringIndex - 1][segment],
          to: pixelIndex,
          accent: deterministicNoise(ringIndex * 17.1 + segment * 29) > 0.965,
        });

        if ((ringIndex + segment) % 2 === 0) {
          links.push({
            from: ringIndexes[ringIndex - 1][(segment + 1) % segmentCount],
            to: pixelIndex,
            accent: deterministicNoise(ringIndex * 53 + segment * 7.7) > 0.975,
          });
        }
      }
    });
  });

  const addFeature = (
    malePoints: VoxelPoint[],
    femalePoints: VoxelPoint[],
    options?: { accent?: boolean; closed?: boolean },
  ) => {
    const indexes = malePoints.map((male, featureIndex) => {
      const seed = deterministicNoise(index + featureIndex * 1.71);

      return addPixel(
        male,
        femalePoints[featureIndex] ?? male,
        seed,
        options?.accent ?? false,
      );
    });

    indexes.slice(1).forEach((pixelIndex, featureIndex) => {
      links.push({
        from: indexes[featureIndex],
        to: pixelIndex,
        accent: options?.accent ?? false,
      });
    });

    if (options?.closed && indexes.length > 2) {
      links.push({
        from: indexes[indexes.length - 1],
        to: indexes[0],
        accent: options.accent ?? false,
      });
    }

    index += malePoints.length;
  };

  const featureLine = (
    start: number,
    end: number,
    count: number,
    makePoint: (value: number, progress: number) => VoxelPoint,
  ) =>
    Array.from({ length: count }, (_, featureIndex) => {
      const progress = featureIndex / (count - 1);

      return makePoint(start + (end - start) * progress, progress);
    });

  for (const side of [-1, 1]) {
    const maleEar = Array.from({ length: 16 }, (_, featureIndex) => {
      const angle = (featureIndex / 16) * Math.PI * 2;

      return {
        x: side * (43 + Math.cos(angle) * 3.6),
        y: -2 + Math.sin(angle) * 11,
        z: -2 + Math.cos(angle) * 1.8,
      };
    });
    const femaleEar = maleEar.map((point) => ({
      ...point,
      x: point.x * 0.93,
      y: point.y - 1,
    }));

    addFeature(maleEar, femaleEar, { closed: true });
  }

  // A quiet center ridge reinforces the nose volume without drawing facial features.
  addFeature(
    featureLine(-24, 18, 15, (value, progress) => ({
      x: Math.sin(progress * Math.PI) * 0.8,
      y: value,
      z: 41 + gaussian(value, 5, 8) * 14,
    })),
    featureLine(-24, 17, 15, (value, progress) => ({
      x: Math.sin(progress * Math.PI) * 0.65,
      y: value - 0.8,
      z: 39 + gaussian(value, 5, 8) * 10,
    })),
  );

  return { links, pixels };
}

function cubicPoint(
  start: Point,
  controlA: Point,
  controlB: Point,
  end: Point,
  progress: number,
) {
  const inverse = 1 - progress;

  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * progress * controlA.x +
      3 * inverse * progress ** 2 * controlB.x +
      progress ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * progress * controlA.y +
      3 * inverse * progress ** 2 * controlB.y +
      progress ** 3 * end.y,
  };
}

export function IntelligenceSignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    const pointer = {
      x: -1000,
      y: -1000,
      screenX: window.innerWidth / 2,
      active: false,
    };
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let width = 0;
    let height = 0;
    let deviceScale = 1;
    let identityCenter: Point = { x: 0, y: 0 };
    let pixels: IdentityPixel[] = [];
    let identityLinks: IdentityLink[] = [];
    let searchTarget: Point = { x: 0, y: 0 };
    let hasSearchTarget = false;
    let morph = 0;
    let morphTarget = 0;
    let subjectWasHovered = false;
    let yaw = 0;
    let frame = 0;
    let lastTime = performance.now();
    const incomingPackets = signalNodes.map((_, index) => ({
      startedAt: -1,
      nextAt: performance.now() + 260 + Math.random() * 1500 + index * 70,
      duration: 1050 + Math.random() * 700,
    }));
    const outboundPacket = {
      startedAt: -1,
      nextAt: performance.now() + 900 + Math.random() * 1000,
      duration: 1250 + Math.random() * 600,
    };

    const refreshSearchTarget = (canvasBounds: DOMRect) => {
      const search = document.querySelector<HTMLElement>(".brutal-hero-search");

      if (!search) {
        hasSearchTarget = false;

        return;
      }

      const searchBounds = search.getBoundingClientRect();

      searchTarget = {
        x: searchBounds.left + searchBounds.width * 0.64 - canvasBounds.left,
        y: searchBounds.top + searchBounds.height * 0.5 - canvasBounds.top,
      };
      hasSearchTarget = true;
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();

      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      deviceScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * deviceScale);
      canvas.height = Math.round(height * deviceScale);
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

      identityCenter = { x: width * 0.59, y: height * 0.49 };
      refreshSearchTarget(bounds);
      const headMesh = makeIdentityPixels(identityCenter, height);

      pixels = headMesh.pixels;
      identityLinks = headMesh.links;
    };

    const repelPoint = (point: Point, radius: number, strength: number) => {
      if (!pointer.active) return point;

      const differenceX = point.x - pointer.x;
      const differenceY = point.y - pointer.y;
      const distance = Math.hypot(differenceX, differenceY);

      if (distance >= radius || distance < 0.01) return point;

      const force = (1 - distance / radius) ** 2 * strength;

      return {
        x: point.x + (differenceX / distance) * force,
        y: point.y + (differenceY / distance) * force,
      };
    };

    const drawGrid = (time: number) => {
      const gridSize = 44;
      const drift = reducedMotion ? 0 : (time * 0.004) % gridSize;

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = "rgba(244, 241, 243, 0.042)";
      context.beginPath();

      for (let x = -gridSize + drift; x <= width; x += gridSize) {
        context.moveTo(Math.round(x) + 0.5, 0);
        context.lineTo(Math.round(x) + 0.5, height);
      }

      for (let y = -gridSize + drift * 0.35; y <= height; y += gridSize) {
        context.moveTo(0, Math.round(y) + 0.5);
        context.lineTo(width, Math.round(y) + 0.5);
      }

      context.stroke();
      context.restore();
    };

    const drawOrbit = (radiusX: number, radiusY: number, alpha: number) => {
      context.save();
      context.setLineDash([2, 10]);
      context.lineWidth = 1;
      context.strokeStyle = `rgba(255, 63, 157, ${alpha})`;
      context.beginPath();
      context.ellipse(
        identityCenter.x,
        identityCenter.y,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.restore();
    };

    const drawSignalPath = (index: number, time: number) => {
      const node = signalNodes[index];
      const anchor = identityAnchors[index];
      const scale = Math.max(0.76, Math.min(1.12, height / 620));
      const start = { x: width * node.x, y: height * node.y };
      const end = {
        x: identityCenter.x + anchor.x * scale,
        y: identityCenter.y + anchor.y * scale,
      };
      const direction = end.x >= start.x ? 1 : -1;
      const span = Math.abs(end.x - start.x);
      const controlA = {
        x: start.x + direction * span * 0.43,
        y: start.y + (end.y - start.y) * 0.07,
      };
      const controlB = {
        x: end.x - direction * span * 0.32,
        y: end.y - (end.y - start.y) * 0.1,
      };

      const pointAt = (progress: number) => {
        const rawPoint = cubicPoint(start, controlA, controlB, end, progress);
        const drift = reducedMotion
          ? 0
          : Math.sin(progress * Math.PI) *
            Math.sin(time * 0.00055 + index * 1.37) *
            1.8;
        const pinWeight = Math.pow(Math.sin(progress * Math.PI), 0.52);

        return repelPoint(
          { x: rawPoint.x, y: rawPoint.y + drift },
          Math.max(210, Math.min(310, width * 0.24)),
          64 * pinWeight,
        );
      };

      const drawBit = (
        value: "0" | "1",
        progress: number,
        alpha: number,
        accent: boolean,
      ) => {
        const point = pointAt(progress);
        const next = pointAt(Math.min(1, progress + 0.006));
        const angle = Math.atan2(next.y - point.y, next.x - point.x);

        context.save();
        context.translate(point.x, point.y);
        context.rotate(angle);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `${value === "1" ? 700 : 500} ${value === "1" ? 9 : 7}px "Courier New", monospace`;
        context.fillStyle = accent
          ? `rgba(255, 63, 157, ${alpha})`
          : `rgba(244, 241, 243, ${alpha})`;

        if (value === "1") {
          context.shadowColor = "rgba(255, 63, 157, 0.9)";
          context.shadowBlur = 7;
        }

        context.fillText(value, 0, 0);
        context.restore();
      };

      const zeroCount = Math.max(18, Math.round(span / 19));

      for (let step = 0; step <= zeroCount; step += 1) {
        const progress = step / zeroCount;
        const pulse = reducedMotion
          ? 1
          : 0.82 + Math.sin(time * 0.0011 + index * 1.7 + step * 0.46) * 0.18;

        drawBit("0", progress, (node.live ? 0.45 : 0.24) * pulse, node.live);
      }

      const packet = incomingPackets[index];

      if (!reducedMotion && packet.startedAt < 0 && time >= packet.nextAt) {
        packet.startedAt = time;
      }

      const packetProgress = reducedMotion
        ? 0.72
        : packet.startedAt < 0
          ? -1
          : (time - packet.startedAt) / packet.duration;

      if (packetProgress >= 0 && packetProgress <= 1) {
        for (let bit = 0; bit < 5; bit += 1) {
          const progress = packetProgress - bit * 0.023;

          if (progress < 0 || progress > 1) continue;

          drawBit("1", progress, 0.98 - bit * 0.13, true);
        }
      }

      if (!reducedMotion && packetProgress > 1) {
        packet.startedAt = -1;
        packet.nextAt = time + 520 + Math.random() * 2400;
        packet.duration = 920 + Math.random() * 880;
      }
    };

    const drawSearchDataPath = (time: number) => {
      if (!hasSearchTarget) return;

      const scale = Math.max(0.76, Math.min(1.12, height / 620));
      const start = {
        x: identityCenter.x - 7 * scale,
        y: identityCenter.y + 31 * scale,
      };
      const end = searchTarget;
      const controlA = {
        x: start.x - Math.max(60, Math.abs(start.x - end.x) * 0.16),
        y: start.y + Math.max(56, Math.abs(end.y - start.y) * 0.42),
      };
      const controlB = {
        x: end.x + Math.max(70, Math.abs(start.x - end.x) * 0.24),
        y: end.y - 24,
      };
      const pointAt = (progress: number) => {
        const rawPoint = cubicPoint(start, controlA, controlB, end, progress);
        const pinWeight = Math.pow(Math.sin(progress * Math.PI), 0.58);

        return repelPoint(
          rawPoint,
          Math.max(210, Math.min(310, width * 0.24)),
          54 * pinWeight,
        );
      };
      const drawBit = (value: "0" | "1", progress: number, alpha: number) => {
        const point = pointAt(progress);
        const next = pointAt(Math.min(1, progress + 0.006));

        context.save();
        context.translate(point.x, point.y);
        context.rotate(Math.atan2(next.y - point.y, next.x - point.x));
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `${value === "1" ? 700 : 500} ${value === "1" ? 9 : 7}px "Courier New", monospace`;
        context.fillStyle =
          value === "1"
            ? `rgba(255, 63, 157, ${alpha})`
            : `rgba(244, 241, 243, ${alpha})`;

        if (value === "1") {
          context.shadowColor = "rgba(255, 63, 157, 0.95)";
          context.shadowBlur = 8;
        }

        context.fillText(value, 0, 0);
        context.restore();
      };
      const distance = Math.hypot(start.x - end.x, start.y - end.y);
      const zeroCount = Math.max(14, Math.round(distance / 18));

      for (let step = 0; step <= zeroCount; step += 1) {
        drawBit("0", step / zeroCount, step % 4 === 0 ? 0.4 : 0.25);
      }

      if (
        !reducedMotion &&
        outboundPacket.startedAt < 0 &&
        time >= outboundPacket.nextAt
      ) {
        outboundPacket.startedAt = time;
      }

      const packetProgress = reducedMotion
        ? 0.62
        : outboundPacket.startedAt < 0
          ? -1
          : (time - outboundPacket.startedAt) / outboundPacket.duration;

      if (packetProgress >= 0 && packetProgress <= 1) {
        for (let bit = 0; bit < 6; bit += 1) {
          const progress = packetProgress - bit * 0.021;

          if (progress < 0 || progress > 1) continue;

          drawBit("1", progress, 1 - bit * 0.11);
        }
      }

      if (!reducedMotion && packetProgress > 1) {
        outboundPacket.startedAt = -1;
        outboundPacket.nextAt = time + 800 + Math.random() * 2200;
        outboundPacket.duration = 1080 + Math.random() * 720;
      }
    };

    const drawNode = (index: number, time: number) => {
      const node = signalNodes[index];
      const x = width * node.x;
      const y = height * node.y;
      const pulse = reducedMotion
        ? 1
        : 1 + Math.sin(time * 0.0015 + index * 0.8) * 0.08;

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = node.live
        ? "rgba(255, 63, 157, 0.9)"
        : "rgba(244, 241, 243, 0.25)";
      context.beginPath();
      context.arc(x, y, 10 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = node.live
        ? "rgba(255, 63, 157, 0.95)"
        : "rgba(244, 241, 243, 0.45)";
      context.fillRect(x - 1.5, y - 1.5, 3, 3);
      context.font = '500 10px "Courier New", monospace';
      context.letterSpacing = "1.6px";
      context.fillStyle = node.live
        ? "rgba(255, 124, 187, 0.64)"
        : "rgba(244, 241, 243, 0.46)";
      context.fillText(node.label, x + 17, y + 3.5);
      context.restore();
    };

    const drawIdentity = (time: number, delta: number) => {
      const renderLegacyMesh = canvas.dataset.identityMode === "mesh";

      if (!renderLegacyMesh) {
        const scale = Math.max(0.76, Math.min(1.12, height / 620));
        const hoverDistance = Math.hypot(
          pointer.x - identityCenter.x,
          pointer.y - identityCenter.y,
        );
        const isCoreHovered = pointer.active && hoverDistance < 96 * scale;
        const pulse = reducedMotion
          ? 0
          : Math.sin(time * 0.0022) * (isCoreHovered ? 3.2 : 1.6);
        const ringExpansion = isCoreHovered ? 8 * scale : 0;

        canvas.dataset.subjectActive = isCoreHovered ? "true" : "false";

        context.save();

        const glow = context.createRadialGradient(
          identityCenter.x,
          identityCenter.y,
          0,
          identityCenter.x,
          identityCenter.y,
          76 * scale + ringExpansion,
        );

        glow.addColorStop(0, "rgba(255, 63, 157, 0.3)");
        glow.addColorStop(0.34, "rgba(255, 63, 157, 0.12)");
        glow.addColorStop(1, "rgba(255, 63, 157, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(
          identityCenter.x,
          identityCenter.y,
          76 * scale + ringExpansion,
          0,
          Math.PI * 2,
        );
        context.fill();

        const drawDiamond = (
          radius: number,
          rotation: number,
          strokeStyle: string,
          dash: number[] = [],
        ) => {
          context.save();
          context.translate(identityCenter.x, identityCenter.y);
          context.rotate(rotation);
          context.setLineDash(dash);
          context.lineDashOffset = reducedMotion ? 0 : -time * 0.01;
          context.strokeStyle = strokeStyle;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(0, -radius);
          context.lineTo(radius, 0);
          context.lineTo(0, radius);
          context.lineTo(-radius, 0);
          context.closePath();
          context.stroke();
          context.restore();
        };

        const outerRotation = reducedMotion ? 0 : time * 0.00008;

        drawDiamond(
          78 * scale + ringExpansion,
          outerRotation,
          "rgba(255, 63, 157, 0.16)",
          [2, 8],
        );
        drawDiamond(
          58 * scale + ringExpansion * 0.5,
          -outerRotation * 1.4,
          "rgba(244, 241, 243, 0.2)",
          [1, 6],
        );
        drawDiamond(
          37 * scale + pulse * 0.18,
          0,
          isCoreHovered ? "rgba(255, 121, 188, 1)" : "rgba(255, 63, 157, 0.92)",
        );

        context.save();
        context.translate(identityCenter.x, identityCenter.y);
        context.beginPath();
        context.moveTo(0, -36 * scale);
        context.lineTo(36 * scale, 0);
        context.lineTo(0, 36 * scale);
        context.lineTo(-36 * scale, 0);
        context.closePath();
        context.fillStyle = "rgba(5, 5, 6, 0.98)";
        context.fill();
        context.clip();

        const scanProgress = reducedMotion ? 0.54 : (time * 0.00022) % 1;
        const scanY = (-27 + scanProgress * 54) * scale;

        context.fillStyle = "rgba(255, 63, 157, 0.08)";
        context.fillRect(
          -36 * scale,
          scanY - 5 * scale,
          72 * scale,
          10 * scale,
        );
        context.strokeStyle = "rgba(255, 63, 157, 0.46)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(-36 * scale, scanY);
        context.lineTo(36 * scale, scanY);
        context.stroke();

        context.font = `600 ${6.5 * scale}px "Courier New", monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";

        for (let row = 0; row < 5; row += 1) {
          for (let column = 0; column < 5; column += 1) {
            const seed = row * 5 + column;
            const bit =
              (Math.floor(time / (170 + seed * 3)) + seed * 7) % 9 === 0
                ? "1"
                : "0";
            const distanceFromScan = Math.abs(row / 4 - scanProgress);

            context.fillStyle =
              bit === "1"
                ? "rgba(255, 63, 157, 0.98)"
                : `rgba(244, 241, 243, ${Math.max(0.2, 0.58 - distanceFromScan * 0.44)})`;
            context.fillText(
              bit,
              (column - 2) * 9 * scale,
              (row - 2) * 9 * scale,
            );
          }
        }

        context.restore();

        const portRadius = (49 * scale + ringExpansion * 0.35) / Math.SQRT2;

        for (let portIndex = 0; portIndex < 4; portIndex += 1) {
          const angle = Math.PI / 4 + portIndex * (Math.PI / 2);
          const portX = identityCenter.x + Math.cos(angle) * portRadius;
          const portY = identityCenter.y + Math.sin(angle) * portRadius;
          const portSize = isCoreHovered ? 4.5 : 3.5;

          context.fillStyle =
            portIndex === 2
              ? "rgba(244, 241, 243, 0.9)"
              : "rgba(255, 63, 157, 0.9)";
          context.fillRect(
            portX - (portSize * scale) / 2,
            portY - (portSize * scale) / 2,
            portSize * scale,
            portSize * scale,
          );
        }

        const labelX = identityCenter.x - 12 * scale;
        const labelY = identityCenter.y + 85 * scale + ringExpansion;

        context.font = '500 10px "Courier New", monospace';
        context.letterSpacing = "1.5px";
        context.fillStyle = "rgba(244, 241, 243, 0.56)";
        context.fillText("SIGNAL FUSION / 08:01", labelX, labelY);
        context.fillStyle = "rgba(255, 63, 157, 0.82)";
        context.fillText(
          isCoreHovered
            ? "KERNEL FIELD: EXPANDED"
            : "INGEST ACTIVE / OUTPUT READY",
          labelX,
          labelY + 21 * scale,
        );
        context.restore();

        return;
      }

      const timeScale = Math.min(2, delta / 16.67);
      const hoverDistance = Math.hypot(
        pointer.x - identityCenter.x,
        pointer.y - identityCenter.y,
      );
      const isSubjectHovered = pointer.active && hoverDistance < 122;

      if (isSubjectHovered && !subjectWasHovered) {
        morphTarget = morphTarget > 0.5 ? 0 : 1;
      }
      subjectWasHovered = isSubjectHovered;

      const targetYaw =
        Math.max(
          -1,
          Math.min(1, (pointer.screenX / window.innerWidth) * 2 - 1),
        ) *
        ((50 * Math.PI) / 180);

      yaw += (targetYaw - yaw) * (reducedMotion ? 0.14 : 0.065);
      morph += (morphTarget - morph) * (reducedMotion ? 0.18 : 0.045);

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const scale = Math.max(0.76, Math.min(1.12, height / 620));

      for (const pixel of pixels) {
        const modelX = pixel.male.x + (pixel.female.x - pixel.male.x) * morph;
        const modelY = pixel.male.y + (pixel.female.y - pixel.male.y) * morph;
        const modelZ = pixel.male.z + (pixel.female.z - pixel.male.z) * morph;
        const rotatedX = modelX * cosYaw + modelZ * sinYaw;
        const rotatedZ = -modelX * sinYaw + modelZ * cosYaw;
        const perspective = 1 + rotatedZ / 360;
        const ditherX = reducedMotion
          ? 0
          : Math.sin(time * 0.0024 + pixel.seed * 41) * 1.25;
        const ditherY = reducedMotion
          ? 0
          : Math.cos(time * 0.002 + pixel.seed * 37) * 0.9;

        pixel.homeX =
          identityCenter.x + rotatedX * scale * perspective + ditherX;
        pixel.homeY = identityCenter.y + modelY * scale * perspective + ditherY;
        pixel.depth = rotatedZ;
      }

      canvas.dataset.subjectActive = isSubjectHovered ? "true" : "false";

      for (const pixel of pixels) {
        const differenceX = pixel.x - pointer.x;
        const differenceY = pixel.y - pointer.y;
        const distance = Math.max(0.1, Math.hypot(differenceX, differenceY));

        if (pointer.active && distance < 132) {
          const force = (1 - distance / 132) ** 2 * 7.8 * timeScale;

          pixel.velocityX += (differenceX / distance) * force;
          pixel.velocityY += (differenceY / distance) * force;
        }

        pixel.velocityX += (pixel.homeX - pixel.x) * 0.034 * timeScale;
        pixel.velocityY += (pixel.homeY - pixel.y) * 0.034 * timeScale;
        pixel.velocityX *= 0.86 ** timeScale;
        pixel.velocityY *= 0.86 ** timeScale;
        pixel.x += pixel.velocityX * timeScale;
        pixel.y += pixel.velocityY * timeScale;
      }

      const drawMeshLinks = (accent: boolean) => {
        context.save();
        context.beginPath();

        for (const link of identityLinks) {
          if (link.accent !== accent) continue;

          const from = pixels[link.from];
          const to = pixels[link.to];
          const distance = Math.hypot(from.x - to.x, from.y - to.y);

          if (distance > 72 * scale) continue;

          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
        }

        context.lineWidth = accent ? 0.9 : 0.72;
        context.strokeStyle = accent
          ? "rgba(255, 63, 157, 0.72)"
          : "rgba(244, 241, 243, 0.34)";
        context.stroke();
        context.restore();
      };

      drawMeshLinks(false);
      drawMeshLinks(true);

      const orderedPixels = [...pixels].sort((a, b) => a.depth - b.depth);

      for (const pixel of orderedPixels) {
        const flicker =
          !reducedMotion && pixel.seed > 0.82
            ? 0.78 + Math.sin(time * 0.004 + pixel.seed * 30) * 0.18
            : 0.9;

        const ditherAccent =
          !reducedMotion &&
          (Math.floor(time / 135) + Math.floor(pixel.seed * 29)) % 11 === 0;

        context.fillStyle =
          pixel.accent || ditherAccent
            ? `rgba(255, 63, 157, ${Math.max(0.42, flicker)})`
            : `rgba(244, 241, 243, ${flicker})`;
        context.fillRect(
          Math.round(pixel.x - pixel.size / 2),
          Math.round(pixel.y - pixel.size / 2),
          pixel.size,
          pixel.size,
        );
      }

      const bracketWidth = 218 * scale;
      const bracketHeight = 232 * scale;
      const left = identityCenter.x - bracketWidth / 2;
      const top = identityCenter.y - bracketHeight / 2;
      const corner = 12;

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = isSubjectHovered
        ? "rgba(255, 63, 157, 0.72)"
        : "rgba(244, 241, 243, 0.22)";
      context.beginPath();
      context.moveTo(left, top + corner);
      context.lineTo(left, top);
      context.lineTo(left + corner, top);
      context.moveTo(left + bracketWidth - corner, top);
      context.lineTo(left + bracketWidth, top);
      context.lineTo(left + bracketWidth, top + corner);
      context.moveTo(left, top + bracketHeight - corner);
      context.lineTo(left, top + bracketHeight);
      context.lineTo(left + corner, top + bracketHeight);
      context.moveTo(left + bracketWidth - corner, top + bracketHeight);
      context.lineTo(left + bracketWidth, top + bracketHeight);
      context.lineTo(left + bracketWidth, top + bracketHeight - corner);
      context.stroke();

      const scanProgress = reducedMotion ? 0.56 : (time * 0.00013) % 1;
      const scanY = top + bracketHeight * scanProgress;

      context.strokeStyle = "rgba(255, 63, 157, 0.2)";
      context.beginPath();
      context.moveTo(left - 8, scanY);
      context.lineTo(left + bracketWidth + 8, scanY);
      context.stroke();
      context.restore();

      context.save();
      context.font = '500 10px "Courier New", monospace';
      context.letterSpacing = "1.5px";
      const identityLabelX =
        width < 700
          ? identityCenter.x - 184 * scale
          : identityCenter.x + 126 * scale;

      context.fillStyle = "rgba(244, 241, 243, 0.56)";
      context.fillText(
        "PROFILE / SYNTHETIC",
        identityLabelX,
        identityCenter.y + 47 * scale,
      );
      context.fillStyle = "rgba(255, 63, 157, 0.78)";
      context.fillText(
        isSubjectHovered
          ? "VOXELS: DISPERSED"
          : `${morph > 0.5 ? "FORM: 02" : "FORM: 01"} / YAW ${Math.round((yaw * 180) / Math.PI)}°`,
        identityLabelX,
        identityCenter.y + 67 * scale,
      );
      context.restore();
    };

    const draw = (time: number) => {
      const delta = time - lastTime;

      lastTime = time;
      context.clearRect(0, 0, width, height);
      drawGrid(time);
      drawOrbit(width * 0.19, height * 0.31, 0.13);
      drawOrbit(width * 0.12, height * 0.21, 0.09);

      for (let index = 0; index < signalNodes.length; index += 1) {
        drawSignalPath(index, time);
      }

      drawSearchDataPath(time);

      for (let index = 0; index < signalNodes.length; index += 1) {
        drawNode(index, time);
      }

      drawIdentity(time, delta);
      frame = window.requestAnimationFrame(draw);
    };

    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();

      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.screenX = event.clientX;
      pointer.active =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
    };

    const clearPointer = () => {
      pointer.active = false;
      pointer.screenX = window.innerWidth / 2;
    };

    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(canvas);
    resize();
    window.addEventListener("pointermove", updatePointer);
    window.addEventListener("pointerleave", clearPointer);
    window.addEventListener("blur", clearPointer);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("blur", clearPointer);
    };
  }, []);

  return (
    <div aria-hidden className="signal-field">
      <canvas ref={canvasRef} className="signal-field-canvas" />
    </div>
  );
}

const caseSignals = [
  { label: "IDENTITY", value: "4 CONFIRMED", x: 15, y: 19 },
  { label: "EXPOSURE", value: "12 RECORDS", x: 72, y: 13 },
  { label: "NETWORK", value: "3 PIVOTS", x: 18, y: 72 },
  { label: "ASSETS", value: "2 LINKED", x: 75, y: 68 },
];

export function IntelligenceCaseVisual() {
  return (
    <div
      aria-label="Example intelligence trace resolving several source types into one case"
      className="case-visual"
      role="img"
    >
      <div className="case-visual-topline">
        <span>ANYA / CASE 0172</span>
        <span>TRACE STATE: RESOLVED</span>
      </div>

      <div className="case-visual-query">
        <span>QUERY</span>
        <strong>target@example.com</strong>
        <i>63 SOURCES / 0.84S</i>
      </div>

      <div className="case-visual-map">
        <svg aria-hidden preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M15 19 C36 22 38 46 50 50" />
          <path d="M72 13 C62 25 63 38 50 50" />
          <path d="M18 72 C33 66 39 56 50 50" />
          <path d="M75 68 C64 63 61 54 50 50" />
          <circle cx="50" cy="50" r="14" />
          <circle cx="50" cy="50" r="3" />
        </svg>

        {caseSignals.map((signal) => (
          <div
            key={signal.label}
            className="case-signal"
            style={{ left: `${signal.x}%`, top: `${signal.y}%` }}
          >
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}

        <div className="case-core-label">
          <span>TARGET</span>
          <strong>01</strong>
        </div>
      </div>

      <div className="case-visual-ledger">
        <div>
          <span>01</span>
          <strong>Alias cluster resolved</strong>
          <i>HIGH CONFIDENCE</i>
        </div>
        <div>
          <span>02</span>
          <strong>Exposure history preserved</strong>
          <i>12 SOURCES</i>
        </div>
        <div>
          <span>03</span>
          <strong>Case graph ready</strong>
          <i>EXPORTABLE</i>
        </div>
      </div>
    </div>
  );
}
