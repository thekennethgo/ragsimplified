"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./Nav.module.css";

const icon = (children: ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const LINKS = [
  {
    href: "/",
    label: "Home",
    icon: icon(
      <>
        <path d="M4 11l8-7 8 7" />
        <path d="M6 10v10h12V10" />
      </>,
    ),
  },
  {
    href: "/upload",
    label: "Upload",
    icon: icon(
      <>
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 20h16" />
      </>,
    ),
  },
  {
    href: "/ask",
    label: "Ask",
    icon: icon(
      <>
        <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" />
        <circle cx="12" cy="18" r="0.6" />
        <circle cx="12" cy="12" r="9" />
      </>,
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Pages" className={styles.nav}>
      {LINKS.map(({ href, label, icon: svg }) => (
        <Link
          key={href}
          href={href}
          className={styles.link}
          aria-current={pathname === href ? "page" : undefined}
        >
          {svg}
          {label}
        </Link>
      ))}
    </nav>
  );
}
