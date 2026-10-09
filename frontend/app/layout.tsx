import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";

import HealthBadge from "../components/HealthBadge";
import Nav from "../components/Nav";
import { PrivateTextsProvider } from "../lib/PrivateTexts";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "ragsimplified",
  description: "A public, forkable RAG web app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <PrivateTextsProvider>
          <div className="page">
            <header>
              <Nav />
              <div className="header-right">
                <span className="brand">ragsimplified</span>
                <HealthBadge />
              </div>
            </header>
            <main>{children}</main>
          </div>
        </PrivateTextsProvider>
      </body>
    </html>
  );
}
