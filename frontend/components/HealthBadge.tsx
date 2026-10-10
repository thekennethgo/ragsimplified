"use client";

import { type Health, useBackendHealth } from "../lib/health";

const LABELS: Record<Health, string> = {
  checking: "Checking library…",
  online: "Library online",
  offline: "Library offline",
};

export default function HealthBadge() {
  const status = useBackendHealth();

  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
