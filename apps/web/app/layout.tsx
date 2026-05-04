import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { ReactNode } from "react";

import { TopNav } from "@/components/nav";
import { Providers } from "@/components/providers";

import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"]
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "mentorXAI",
  description: "mentorXAI mentorship marketplace"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <Providers>
          <TopNav />
          {/*
            No max-width or padding constraints here — every page is responsible
            for its own inner layout. The TopNav is sticky and full-width.
          */}
          <main className="w-full">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
