import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { cookies } from "next/headers";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app";
import { ServiceWorker } from "@/components/providers/ServiceWorker";
import { DEFAULT_THEME, isThemeId, SCHEME_COLORS, THEME_COOKIE, type ThemeId } from "@/lib/themes";
import "./globals.css";

// Atkinson Hyperlegible Next (SIL OFL, Braille Institute): letterforms built
// to stay distinct (I/l/1, O/0, b/d) for low-vision and tired eyes.
// The Mono sibling is used only for numbers that should line up.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson",
  display: "swap",
});
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  display: "swap",
  preload: false,
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
    <html lang="en" data-theme={theme} className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
