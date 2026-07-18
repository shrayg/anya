import Image from "next/image";
import type { IconType } from "react-icons";
import { BsFillTelephoneFill } from "react-icons/bs";
import {
  SiBadoo,
  SiBitcoin,
  SiCloudflare,
  SiDatadog,
  SiDiscord,
  SiEthereum,
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
  TbBrandGrindr,
  TbBrandMinecraft,
  TbBrandXbox,
  TbBug,
  TbBuildingBank,
  TbCar,
  TbClipboardList,
  TbCreditCard,
  TbDatabase,
  TbDatabaseExclamation,
  TbDatabaseSearch,
  TbFingerprint,
  TbFlag3,
  TbGavel,
  TbGlobe,
  TbHash,
  TbHeart,
  TbHeartRateMonitor,
  TbIdBadge,
  TbLockPassword,
  TbMailSearch,
  TbMap2,
  TbMapPin,
  TbRadar2,
  TbShare2,
  TbShieldCheck,
  TbShieldLock,
  TbShieldX,
  TbUserExclamation,
  TbUserSearch,
  TbUserStar,
  TbWorldWww,
} from "react-icons/tb";

type BrandIconConfig = {
  Icon?: IconType;
  imageSrc?: string;
  color?: string;
};

const MODULE_BRANDS: Record<string, BrandIconConfig> = {
  Phone: { Icon: BsFillTelephoneFill, color: "#34D399" },
  Email: { Icon: SiGmail, color: "#EA4335" },
  Username: { Icon: TbUserStar, color: "#C084FC" },
  "Name Search": { Icon: TbUserSearch, color: "#38BDF8" },
  "Fraud Footprint": { Icon: TbFingerprint, color: "#FBBF24" },
  "Contact Enrich": { Icon: TbAddressBook, color: "#2DD4BF" },
  "Leak Storage": { Icon: TbDatabaseSearch, color: "#A78BFA" },
  "Stealer Logs": { Icon: TbDatabaseSearch, color: "#FF6B35" },
  Breaches: { Icon: TbDatabaseSearch, color: "#FF6B35" },
  "Hash Lookup": { Icon: TbHash, color: "#A78BFA" },
  "Password Search": { Icon: TbLockPassword, color: "#F87171" },
  "Email Analyzer": { Icon: TbMailSearch, color: "#F472B6" },
  "Breach Index": { Icon: TbDatabaseExclamation, color: "#FB7185" },
  "Email Leak Check": { Icon: SiGmail, color: "#EA4335" },
  IP: { Icon: TbWorldWww, color: "#22D3EE" },
  Domain: { Icon: SiCloudflare, color: "#F38020" },
  Domains: { Icon: SiCloudflare, color: "#F38020" },
  "Host Lookup": { Icon: TbRadar2, color: "#C084FC" },
  "Site Pentest": { Icon: TbBug, color: "#F43F5E" },
  "Crypto Wallet": { Icon: SiBitcoin, color: "#F7931A" },
  "BIN Lookup": { Icon: TbCreditCard, color: "#6366F1" },
  "IBAN Check": { Icon: TbBuildingBank, color: "#0EA5E9" },
  "Bank Search US": { Icon: TbBuildingBank, color: "#14B8A6" },
  "VIN Decoder US": { Icon: TbCar, color: "#EF4444" },
  "Car Insurance US": { Icon: TbShieldCheck, color: "#F59E0B" },
  "Health Care US": { Icon: TbHeartRateMonitor, color: "#EC4899" },
  "Discord ID": { Icon: SiDiscord, color: "#5865F2" },
  Roblox: { Icon: SiRoblox, color: "#00A2FF" },
  "Discord → Roblox": { Icon: TbArrowsExchange2, color: "#5865F2" },
  Minecraft: { Icon: TbBrandMinecraft, color: "#62B47A" },
  Steam: { Icon: SiSteam, color: "#66C0F4" },
  Xbox: { Icon: TbBrandXbox, color: "#107C10" },
  PlayStation: { Icon: SiPlaystation, color: "#0070D1" },
  Telegram: { Icon: SiTelegram, color: "#26A5E4" },
  Instagram: { Icon: SiInstagram, color: "#E4405F" },
  Snapchat: { Icon: SiSnapchat, color: "#FFFC00" },
  TikTok: { Icon: SiTiktok, color: "#FE2C55" },
  "TikTok Recon": { Icon: SiTiktok, color: "#FE2C55" },
  "Share Resolver": { Icon: TbShare2, color: "#E4405F" },
  Twitter: { Icon: SiX, color: "#FFFFFF" },
  Reddit: { Icon: SiReddit, color: "#FF4500" },
  GitHub: { Icon: SiGithub, color: "#FFFFFF" },
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
  "Crypto AI Analyse": { Icon: SiBitcoin, color: "#F7931A" },
  "Threat Brief": { Icon: SiSnyk, color: "#4C427A" },
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
}: {
  name: string;
  className?: string;
}) {
  const brand = MODULE_BRANDS[name];

  if (!brand) return null;

  if (brand.imageSrc) {
    return (
      <Image
        alt={`${name} logo`}
        className={className}
        height={16}
        src={brand.imageSrc}
        unoptimized
        width={16}
      />
    );
  }

  if (!brand.Icon) return null;

  const { Icon, color } = brand;

  return (
    <Icon
      aria-hidden
      className={className}
      style={{ color }}
    />
  );
}

export const ModuleBrandIcon = PlatformBrandIcon;
