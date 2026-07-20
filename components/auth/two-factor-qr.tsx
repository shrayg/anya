"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import QRCode from "qrcode";

import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";

type TwoFactorQrProps = {
  otpauthUrl: string;
  size?: number;
  className?: string;
};

/**
 * Rounded-module canvas QR with centered Anya logo, wrapped in LiquidGlassCard.
 * Full WebGL displacement (Aave-style) is optional/future — glass SVG filter
 * on LiquidGlassCard provides the interactive frosted look without heavy shaders.
 */
export function TwoFactorQr({
  otpauthUrl,
  size = 220,
  className,
}: TwoFactorQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const canvas = canvasRef.current;

      if (!canvas || !otpauthUrl) return;

      try {
        const qr = QRCode.create(otpauthUrl, { errorCorrectionLevel: "H" });
        const modules = qr.modules;
        const count = modules.size;
        const padding = 2;
        const cell = size / (count + padding * 2);
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        canvas.width = size;
        canvas.height = size;

        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#0a0c10";
        roundRect(ctx, 0, 0, size, size, 28);
        ctx.fill();

        const logoHole = Math.floor(count * 0.22);
        const mid = (count - 1) / 2;
        const holeStart = mid - logoHole / 2;
        const holeEnd = mid + logoHole / 2;

        ctx.fillStyle = "#f4f6fa";

        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (!modules.get(row, col)) continue;

            const inLogo =
              row >= holeStart &&
              row <= holeEnd &&
              col >= holeStart &&
              col <= holeEnd;

            if (inLogo) continue;

            const x = (col + padding) * cell;
            const y = (row + padding) * cell;
            const r = cell * 0.32;

            roundRect(ctx, x + cell * 0.08, y + cell * 0.08, cell * 0.84, cell * 0.84, r);
            ctx.fill();
          }
        }

        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void draw();

    return () => {
      cancelled = true;
    };
  }, [otpauthUrl, size]);

  const logoBox = Math.round(size * 0.22);

  return (
    <LiquidGlassCard
      blurIntensity="md"
      borderRadius="24px"
      className={clsx("mx-auto w-fit p-3", className)}
      glowIntensity="sm"
      shadowIntensity="md"
    >
      <div
        className="relative overflow-hidden rounded-[20px]"
        style={{ width: size, height: size }}
      >
        {failed ? (
          <div className="flex size-full items-center justify-center bg-zinc-900 text-center text-xs text-zinc-400">
            Could not render QR. Use the secret key below.
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label="Two-factor authenticator QR code"
            className="block size-full"
            height={size}
            width={size}
          />
        )}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#0a0c10] p-1.5 ring-1 ring-white/15"
          style={{ width: logoBox + 12, height: logoBox + 12 }}
        >
          <Image
            unoptimized
            alt={`${siteConfig.name} logo`}
            className={clsx(siteLogoClassName, "size-full")}
            height={logoBox}
            src={siteLogoSrc}
            width={logoBox}
          />
        </div>
      </div>
    </LiquidGlassCard>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
