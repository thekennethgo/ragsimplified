import type { Metadata } from "next";
import type { ReactNode } from "react";

import HealthBadge from "../components/HealthBadge";
import Nav from "../components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ragsimplified",
  description: "A public, forkable RAG web app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Nav />
          <HealthBadge />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
