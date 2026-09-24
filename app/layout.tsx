import type { Metadata, Viewport } from "next";
import { Anton, Barlow } from "next/font/google";
import { cookies } from "next/headers";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app";
import { ServiceWorker } from "@/components/providers/ServiceWorker";
import { DEFAULT_THEME, isThemeId, SCHEME_COLORS, THEME_COOKIE, type ThemeId } from "@/lib/themes";
import "./globals.css";

// Anton (SIL OFL) for display type, Barlow (SIL OFL) for reading.
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
};

async function storedTheme(): Promise<ThemeId> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await storedTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: SCHEME_COLORS.light },
            { media: "(prefers-color-scheme: dark)", color: SCHEME_COLORS.dark },
          ]
        : SCHEME_COLORS[theme],
    colorScheme: theme === "system" ? "light dark" : theme,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await storedTheme();

  return (
    <html lang="en" data-theme={theme} className={`${anton.variable} ${barlow.variable} antialiased`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
