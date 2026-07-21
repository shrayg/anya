import type { IconType } from "react-icons";

import Image from "next/image";
import {
  SiBadoo,
  SiCloudflare,
  SiDatadog,
  SiDiscord,
  SiFivem,
  SiGithub,
  SiGmail,
  SiGooglegemini,
  SiInstagram,
  SiOkcupid,
  SiPlaystation,
  SiReddit,
  SiRoblox,
  SiSnapchat,
  SiSteam,
  SiSnyk,
  SiTelegram,
  SiTiktok,
  SiTinder,
  SiX,
} from "react-icons/si";
import {
  TbAddressBook,
  TbArrowsExchange2,
  TbBrandBumble,
  TbBrandDiscord,
  TbBrandGithub,
  TbBrandGrindr,
  TbBrandInstagram,
  TbBrandMinecraft,
  TbBrandReddit,
  TbBrandSnapchat,
  TbBrandSteam,
  TbBrandTelegram,
  TbBrandTiktok,
  TbBrandX,
  TbBrandXbox,
  TbBug,
  TbBuildingBank,
  TbCar,
  TbChartPie,
  TbClipboardList,
  TbCloud,
  TbCreditCard,
  TbCurrencyBitcoin,
  TbDatabase,
  TbDatabaseExclamation,
  TbDatabaseSearch,
  TbFileSearch,
  TbFingerprint,
  TbFlag3,
  TbGavel,
  TbGitBranch,
  TbGlobe,
  TbHash,
  TbHeart,
  TbHeartRateMonitor,
  TbIdBadge,
  TbLockPassword,
  TbMail,
  TbMailSearch,
  TbMap2,
  TbMapPin,
  TbNetwork,
  TbPhone,
  TbRadar2,
  TbShare2,
  TbShieldCheck,
  TbShieldExclamation,
  TbShieldLock,
  TbShieldX,
  TbSpeakerphone,
  TbUserExclamation,
  TbUserSearch,
  TbUserStar,
  TbWallet,
  TbWorldWww,
} from "react-icons/tb";

type BrandIconConfig = {
  Icon?: IconType;
  /** Outline Tabler (or similar) mark preferred in muted/sidebar contexts. */
  OutlineIcon?: IconType;
  imageSrc?: string;
  color?: string;
};

const MODULE_BRANDS: Record<string, BrandIconConfig> = {
  Phone: { Icon: TbPhone, color: "#34D399" },
  Email: { Icon: SiGmail, OutlineIcon: TbMail, color: "#EA4335" },
  Username: { Icon: TbUserStar, color: "#C084FC" },
  "Name Search": { Icon: TbUserSearch, color: "#38BDF8" },
  "Fraud Footprint": { Icon: TbFingerprint, color: "#FBBF24" },
  "Contact Enrich": { Icon: TbAddressBook, color: "#2DD4BF" },
  IntelX: { Icon: TbDatabaseSearch, color: "#A78BFA" },
  "Leak Storage": { Icon: TbDatabaseSearch, color: "#A78BFA" },
  "Stealer Logs": { Icon: TbDatabaseSearch, color: "#FF6B35" },
  Breaches: { Icon: TbDatabaseSearch, color: "#FF6B35" },
  "Hash Lookup": { Icon: TbHash, color: "#A78BFA" },
  "Password Search": { Icon: TbLockPassword, color: "#F87171" },
  "Email Analyzer": { Icon: TbMailSearch, color: "#F472B6" },
  "Breach Index": { Icon: TbDatabaseExclamation, color: "#FB7185" },
  "Email Leak Check": { Icon: SiGmail, OutlineIcon: TbMail, color: "#EA4335" },
  IP: { Icon: TbWorldWww, color: "#22D3EE" },
  Domain: { Icon: SiCloudflare, OutlineIcon: TbCloud, color: "#F38020" },
  Domains: { Icon: SiCloudflare, OutlineIcon: TbCloud, color: "#F38020" },
  "Host Lookup": { Icon: TbRadar2, color: "#C084FC" },
  "Site Pentest": { Icon: TbBug, color: "#F43F5E" },
  "Crypto Wallet": {
    Icon: TbCurrencyBitcoin,
    OutlineIcon: TbCurrencyBitcoin,
    color: "#F7931A",
  },
  "Address Intel": { Icon: TbWallet, color: "#38BDF8" },
  "Tx Deep Dive": { Icon: TbFileSearch, color: "#22D3EE" },
  "Risk Check": { Icon: TbShieldExclamation, color: "#F87171" },
  "Fund Flow": { Icon: TbGitBranch, color: "#34D399" },
  "Top Holders": { Icon: TbChartPie, color: "#C084FC" },
  "CEX Flows": { Icon: TbBuildingBank, color: "#0EA5E9" },
  "Social Narrative": { Icon: TbSpeakerphone, color: "#F472B6" },
  "Bridge Monitor": { Icon: TbNetwork, color: "#818CF8" },
  "BIN Lookup": { Icon: TbCreditCard, color: "#6366F1" },
  "IBAN Check": { Icon: TbBuildingBank, color: "#0EA5E9" },
  "Bank Search US": { Icon: TbBuildingBank, color: "#14B8A6" },
  "VIN Decoder US": { Icon: TbCar, color: "#EF4444" },
  "Car Insurance US": { Icon: TbShieldCheck, color: "#F59E0B" },
  "Health Care US": { Icon: TbHeartRateMonitor, color: "#EC4899" },
  "Discord ID": {
    Icon: SiDiscord,
    OutlineIcon: TbBrandDiscord,
    color: "#5865F2",
  },
  Roblox: { Icon: SiRoblox, color: "#00A2FF" },
  "Discord → Roblox": { Icon: TbArrowsExchange2, color: "#5865F2" },
  Minecraft: { Icon: TbBrandMinecraft, color: "#62B47A" },
  Steam: { Icon: SiSteam, OutlineIcon: TbBrandSteam, color: "#66C0F4" },
  Xbox: { Icon: TbBrandXbox, color: "#107C10" },
  PlayStation: { Icon: SiPlaystation, color: "#0070D1" },
  Telegram: {
    Icon: SiTelegram,
    OutlineIcon: TbBrandTelegram,
    color: "#26A5E4",
  },
  Instagram: {
    Icon: SiInstagram,
    OutlineIcon: TbBrandInstagram,
    color: "#E4405F",
  },
  Snapchat: {
    Icon: SiSnapchat,
    OutlineIcon: TbBrandSnapchat,
    color: "#FFFC00",
  },
  TikTok: { Icon: SiTiktok, OutlineIcon: TbBrandTiktok, color: "#FE2C55" },
  "TikTok Recon": {
    Icon: SiTiktok,
    OutlineIcon: TbBrandTiktok,
    color: "#FE2C55",
  },
  "Share Resolver": { Icon: TbShare2, color: "#E4405F" },
  Twitter: { Icon: SiX, OutlineIcon: TbBrandX, color: "#FFFFFF" },
  Reddit: { Icon: SiReddit, OutlineIcon: TbBrandReddit, color: "#FF4500" },
  GitHub: { Icon: SiGithub, OutlineIcon: TbBrandGithub, color: "#FFFFFF" },
  FiveM: { Icon: SiFivem, color: "#F40552" },
  Tinder: { Icon: SiTinder, color: "#FE3C72" },
  Bumble: { Icon: TbBrandBumble, color: "#FFC629" },
  Hinge: { Icon: TbHeart, color: "#7B3FE4" },
  Match: { Icon: TbHeart, color: "#FF5A5F" },
  OkCupid: { Icon: SiOkcupid, color: "#0500FF" },
  "Plenty of Fish": { Icon: TbHeart, color: "#FF6B35" },
  Grindr: { Icon: TbBrandGrindr, color: "#FEDD00" },
  Badoo: { Icon: SiBadoo, color: "#783BF9" },
  "AI Search": { Icon: SiGooglegemini, color: "#8E75B2" },
  "AI Deep Scan": { Icon: SiDatadog, color: "#632CA6" },
  "Crypto AI Analyse": {
    Icon: TbCurrencyBitcoin,
    OutlineIcon: TbCurrencyBitcoin,
    color: "#F7931A",
  },
  "Threat Brief": { Icon: SiSnyk, color: "#4C427A" },
  "Public Records": { Icon: TbGlobe, color: "#38BDF8" },
  "Global Public Records": { Icon: TbGlobe, color: "#38BDF8" },
  "Court Records": { Icon: TbGavel, color: "#D4A574" },
  "Identity Search": { Icon: TbIdBadge, color: "#94A3B8" },
  "NPD Database Search": { Icon: TbDatabase, color: "#818CF8" },
  "Sanctions & Watchlists": { Icon: TbShieldX, color: "#F87171" },
  "Wanted Persons": { Icon: TbUserExclamation, color: "#FB923C" },
  "National Sex Offender Registry": { Icon: TbShieldLock, color: "#E879A8" },
  "VA Sex Offender Registry": { Icon: TbMapPin, color: "#C084FC" },
  "US State Records Directory": { Icon: TbMap2, color: "#34D399" },
  "Portal Adapter Backlog": { Icon: TbClipboardList, color: "#A1A1AA" },
  "International Records Directory": { Icon: TbFlag3, color: "#60A5FA" },
};

export function hasPlatformBrandIcon(name: string) {
  return name in MODULE_BRANDS;
}

export function hasModuleBrandIcon(name: string) {
  return hasPlatformBrandIcon(name);
}

export function PlatformBrandIcon({
  name,
  className = "size-4 shrink-0",
  muted = false,
  variant,
}: {
  name: string;
  className?: string;
  /** Grey outline mode — skips brand fill colors (sidebar / catalog). */
  muted?: boolean;
  /** Alias for muted when `variant="sidebar"`. */
  variant?: "default" | "sidebar";
}) {
  const brand = MODULE_BRANDS[name];
  const isMuted = muted || variant === "sidebar";

  if (!brand) return null;

  if (brand.imageSrc) {
    return (
      <Image
        unoptimized
        alt={`${name} logo`}
        className={className}
        height={16}
        src={brand.imageSrc}
        style={isMuted ? { filter: "grayscale(1) opacity(0.75)" } : undefined}
        width={16}
      />
    );
  }

  const Icon = isMuted
    ? (brand.OutlineIcon ?? brand.Icon)
    : brand.Icon;

  if (!Icon) return null;

  if (isMuted) {
    return <Icon aria-hidden className={className} />;
  }

  const { color } = brand;

  return <Icon aria-hidden className={className} style={{ color }} />;
}

export const ModuleBrandIcon = PlatformBrandIcon;
