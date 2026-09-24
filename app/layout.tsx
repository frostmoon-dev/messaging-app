import type { Metadata, Viewport } from "next";
import { Anton, Barlow } from "next/font/google";
import { cookies } from "next/headers";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app";
import { ServiceWorker } from "@/components/providers/ServiceWorker";
import { DEFAULT_THEME, isThemeId, THEME_COLORS, THEME_COOKIE } from "@/lib/themes";
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
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    themeColor: THEME_COLORS[isThemeId(theme) ? theme : DEFAULT_THEME],
    colorScheme: "dark",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isThemeId(stored) ? stored : DEFAULT_THEME;

  return (
    <html lang="en" data-theme={theme} className={`${anton.variable} ${barlow.variable} antialiased`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
