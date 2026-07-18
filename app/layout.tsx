import "@/styles/globals.css";
import "@/styles/anya-pro.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { Bruno_Ace_SC } from "next/font/google";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontMono, fontSans } from "@/config/fonts";
import {
  siteIconSrc,
  siteLogoSrc,
  TEST_LIME_ICON_THEME,
  TEST_MAC_DASHBOARD_THEME,
} from "@/config/branding";

const brunoAceSc = Bruno_Ace_SC({
  subsets: ["latin"],
  variable: "--font-bruno-ace-sc",
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: siteIconSrc, type: "image/png" },
    ],
    apple: siteLogoSrc,
  },
  other: {
    // Cryptomus merchant domain verification
    cryptomus: "d9415829",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: TEST_LIME_ICON_THEME ? "#b8f042" : "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={clsx(
        "dark",
        fontSans.variable,
        fontMono.variable,
        brunoAceSc.variable,
        TEST_LIME_ICON_THEME && "theme-lime-test",
        TEST_MAC_DASHBOARD_THEME && "theme-mac-dashboard",
      )}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background font-sans text-foreground antialiased [font-feature-settings:'ss01'_on,'cv11'_on]"
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
