"use client";

import { useEffect } from "react";

import styles from "./Toast.module.css";

/** A short notice at the bottom of the screen that hides itself after a few seconds. */
export default function Toast({
  message,
  action,
  onClose,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div role="status" className={styles.toast}>
      <p>{message}</p>
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
      <button type="button" aria-label="Close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
