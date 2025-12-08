"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000 * 60); // Update every minute is enough for HH:mm
    return () => clearInterval(interval);
  }, []);

  if (!time) return <div className="w-32 h-5 bg-muted/20 animate-pulse rounded" />;

  const formatted = time.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return (
    <div className="text-xs text-muted-foreground font-mono">
      {formatted}
    </div>
  );
}
