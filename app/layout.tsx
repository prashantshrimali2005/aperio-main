import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { primaryOrigin } from "@/lib/origin";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const siteUrl = primaryOrigin("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Aperio — Career readiness intelligence", template: "%s · Aperio" },
  description:
    "Understand your skills, close the gap, and reach the role with evidence-based career readiness analysis.",
  applicationName: "Aperio",
  keywords: ["career readiness", "skill gap analysis", "resume analysis", "career roadmap", "upskilling"],
  authors: [{ name: "Aperio" }],
  openGraph: {
    type: "website",
    siteName: "Aperio",
    title: "Aperio — Career readiness intelligence",
    description:
      "Map what your profile proves against what your target role needs — then turn the gap into a plan you can follow.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Aperio — Career readiness intelligence",
    description:
      "Evidence-based career readiness analysis: skills, gaps, and a roadmap you can follow.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#080e17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
