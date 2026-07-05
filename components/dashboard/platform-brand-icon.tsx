import Image from "next/image";
import type { IconType } from "react-icons";
import { BsFillTelephoneFill } from "react-icons/bs";
import {
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
  SiPlaystation,
  SiReddit,
  SiRoblox,
  SiSnapchat,
  SiSteam,
  SiSnyk,
  SiTelegram,
  SiTiktok,
  SiX,
} from "react-icons/si";
import {
  TbBrandMinecraft,
  TbBrandXbox,
  TbBuildingBank,
  TbCar,
  TbCreditCard,
  TbDatabaseSearch,
  TbHash,
  TbHeartRateMonitor,
  TbLockPassword,
  TbShieldCheck,
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
  IntelX: { imageSrc: "/images/intelx-logo.png" },
  "Stealer Logs": { Icon: TbDatabaseSearch, color: "#FF6B35" },
  Breaches: { Icon: TbDatabaseSearch, color: "#FF6B35" },
  "Hash Lookup": { Icon: TbHash, color: "#A78BFA" },
  "Password Search": { Icon: TbLockPassword, color: "#F87171" },
  "Email Leak Check": { Icon: SiGmail, color: "#EA4335" },
  IP: { Icon: TbWorldWww, color: "#22D3EE" },
  Domain: { Icon: SiCloudflare, color: "#F38020" },
  Domains: { Icon: SiCloudflare, color: "#F38020" },
  "Crypto Wallet": { Icon: SiBitcoin, color: "#F7931A" },
  "BIN Lookup": { Icon: TbCreditCard, color: "#6366F1" },
  "IBAN Check": { Icon: TbBuildingBank, color: "#0EA5E9" },
  "Bank Search US": { Icon: TbBuildingBank, color: "#14B8A6" },
  "VIN Decoder US": { Icon: TbCar, color: "#EF4444" },
  "Car Insurance US": { Icon: TbShieldCheck, color: "#F59E0B" },
  "Health Care US": { Icon: TbHeartRateMonitor, color: "#EC4899" },
  "Discord ID": { Icon: SiDiscord, color: "#5865F2" },
  Roblox: { Icon: SiRoblox, color: "#00A2FF" },
  Minecraft: { Icon: TbBrandMinecraft, color: "#62B47A" },
  Steam: { Icon: SiSteam, color: "#66C0F4" },
  Xbox: { Icon: TbBrandXbox, color: "#107C10" },
  PlayStation: { Icon: SiPlaystation, color: "#0070D1" },
  Telegram: { Icon: SiTelegram, color: "#26A5E4" },
  Instagram: { Icon: SiInstagram, color: "#E4405F" },
  Snapchat: { Icon: SiSnapchat, color: "#FFFC00" },
  TikTok: { Icon: SiTiktok, color: "#FE2C55" },
  Twitter: { Icon: SiX, color: "#FFFFFF" },
  Reddit: { Icon: SiReddit, color: "#FF4500" },
  GitHub: { Icon: SiGithub, color: "#FFFFFF" },
  FiveM: { Icon: SiFivem, color: "#F40552" },
  "AI Search": { Icon: SiGooglegemini, color: "#8E75B2" },
  "AI Deep Scan": { Icon: SiDatadog, color: "#632CA6" },
  "Crypto AI Analyse": { Icon: SiBitcoin, color: "#F7931A" },
  "Threat Brief": { Icon: SiSnyk, color: "#4C427A" },
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
