"use client";

import { useState } from "react";

interface TimeClientProps {
  timestamp: number;
  className?: string;
}

/**
 * Client-only time display to avoid hydration mismatch.
 * Returns empty string on server, formats time after mount.
 */
export default function TimeClient({ timestamp, className }: TimeClientProps) {
  const [formatted] = useState(() =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  );

  return <p className={className}>{formatted}</p>;
}
