"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Checking library…",
  online: "Library online",
  offline: "Library offline",
};

export default function HealthBadge() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(60_000) })
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
