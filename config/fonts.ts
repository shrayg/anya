import {
  IBM_Plex_Mono as FontMono,
  Plus_Jakarta_Sans as FontSans,
} from "next/font/google";

/** Primary UI face — geometric, calm, enterprise SaaS. */
export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-anya-sans",
  weight: ["400", "500", "600", "700"],
});

/** Data / inputs / code. */
export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-anya-mono",
  weight: ["400", "500", "600"],
});
