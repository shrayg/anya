"use client";

import { useMemo } from "react";

import {
  type DiscordNameplate,
} from "@/lib/discord-profile";

/**
 * Local QA page for Discord nameplate animation.
 * http://localhost:3000/dev/nameplate-preview
 */
const SAMPLES: DiscordNameplate[] = [
  {
    asset: "nameplates/spell/white_mana/",
    url: "https://cdn.discordapp.com/assets/collectibles/nameplates/spell/white_mana/static.png",
    animatedUrl:
      "https://cdn.discordapp.com/assets/collectibles/nameplates/spell/white_mana/asset.webm",
    animatedImageUrl:
      "https://cdn.discordapp.com/assets/collectibles/nameplates/spell/white_mana/img.png",
    label: null,
    description: "White Mana (video → APNG fallback)",
    palette: "bubble_gum",
  },
  {
    asset: "nameplates/nameplates/twilight/",
    url: "https://cdn.discordapp.com/assets/collectibles/nameplates/nameplates/twilight/static.png",
    animatedUrl:
      "https://cdn.discordapp.com/assets/collectibles/nameplates/nameplates/twilight/asset.webm",
    animatedImageUrl:
      "https://cdn.discordapp.com/assets/collectibles/nameplates/nameplates/twilight/img.png",
    label: null,
    description: "Twilight",
    palette: "cobalt",
  },
];

function PreviewPlate({ nameplate }: { nameplate: DiscordNameplate }) {
  return (
    <div className="discord-id-nameplate" style={{ margin: 0 }}>
      <span className="discord-id-nameplate-tag">Nameplate</span>
      <div
        className="discord-id-nameplate-art"
        style={
          nameplate.palette === "cobalt"
            ? { backgroundColor: "#2f5fad" }
            : nameplate.palette === "bubble_gum"
              ? { backgroundColor: "#d45a8a" }
              : undefined
        }
      >
        <video
          aria-hidden
          autoPlay
          className="discord-id-nameplate-media"
          loop
          muted
          playsInline
          poster={nameplate.url}
          preload="auto"
        >
          <source src={nameplate.animatedUrl ?? undefined} type="video/webm" />
        </video>
        {nameplate.description ? (
          <p className="discord-id-nameplate-desc">{nameplate.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function PreviewApng({ nameplate }: { nameplate: DiscordNameplate }) {
  return (
    <div className="discord-id-nameplate" style={{ margin: 0 }}>
      <span className="discord-id-nameplate-tag">APNG</span>
      <div className="discord-id-nameplate-art">
        <img
          alt=""
          aria-hidden
          className="discord-id-nameplate-media"
          src={nameplate.animatedImageUrl ?? nameplate.url}
        />
      </div>
    </div>
  );
}

export default function NameplatePreviewPage() {
  const samples = useMemo(() => SAMPLES, []);

  return (
    <main className="mx-auto max-w-xl space-y-8 bg-[#09090b] px-4 py-10 text-white">
      <h1 className="text-lg font-semibold">Nameplate animation QA</h1>
      <p className="text-sm text-zinc-400">
        Left column uses <code>&lt;video&gt;</code> (asset.webm). Right uses{" "}
        <code>&lt;img&gt;</code> APNG (img.png). Both should clearly animate.
      </p>
      {samples.map((plate) => (
        <section key={plate.asset} className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">{plate.asset}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewPlate nameplate={plate} />
            <PreviewApng nameplate={plate} />
          </div>
          <ul className="space-y-1 font-mono text-[11px] text-zinc-500">
            <li>webm: {plate.animatedUrl}</li>
            <li>apng: {plate.animatedImageUrl}</li>
            <li>static: {plate.url}</li>
          </ul>
        </section>
      ))}
    </main>
  );
}
