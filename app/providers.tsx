"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { Suspense } from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { ScrollToTop } from "@/components/scroll-to-top";
import { SplashScreen } from "@/components/splash-screen";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider
        {...themeProps}
        disableTransitionOnChange
        enableColorScheme={false}
        enableSystem={false}
        forcedTheme="dark"
      >
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <SplashScreen />
        {children}
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
