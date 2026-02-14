import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://json-render.dev"),
  title: {
    default: "json-render | AI-generated UI with guardrails",
    template: "%s | json-render",
  },
  description:
    "Let users generate dashboards, widgets, apps, and data visualizations from prompts — safely constrained to components you define.",
  keywords: [
    "json-render",
    "AI UI generation",
    "React components",
    "guardrails",
    "structured output",
    "dashboard builder",
  ],
  authors: [{ name: "Vercel Labs" }],
  creator: "Vercel Labs",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://json-render.dev",
    siteName: "json-render",
    title: "json-render | AI-generated UI with guardrails",
    description:
      "Let users generate dashboards, widgets, apps, and data visualizations from prompts — safely constrained to components you define.",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "json-render - AI-generated UI with guardrails",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "json-render | AI-generated UI with guardrails",
    description:
      "Let users generate dashboards, widgets, apps, and data visualizations from prompts — safely constrained to components you define.",
    images: ["/og"],
    creator: "@verabornnot",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
