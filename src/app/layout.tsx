import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Bebas_Neue } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  title: "jaaw - just another academia wrapper",
  description: "just another academia wrapper"
};

export const viewport: Viewport = {
  themeColor: "#060606",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  width: "device-width"
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark h-full antialiased ${bebasNeue.variable}`}
    >
      <head>
        <link href="https://fonts.cdnfonts.com/css/sf-pro-display" rel="stylesheet"></link>
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Caveat:wght@600&display=swap" rel="stylesheet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="jaaw" />
        <meta name="theme-color" content="#060606"></meta>
      </head>
      <body>
        <div className="topbar" aria-hidden="true"></div>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
