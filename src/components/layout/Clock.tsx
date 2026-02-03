"use client";

import { useEffect, useMemo, useState } from "react";

type CountryCode = string;

const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  KR: "Asia/Seoul",
  JP: "Asia/Tokyo",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  TW: "Asia/Taipei",
  SG: "Asia/Singapore",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  PH: "Asia/Manila",
  ID: "Asia/Jakarta",
  IN: "Asia/Kolkata",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  TR: "Europe/Istanbul",

  GB: "Europe/London",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  RU: "Europe/Moscow",

  US: "America/New_York", // 미국은 여러 타임존이라 대표값(원하면 세분화 가능)
  CA: "America/Toronto",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",

  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
};

function getTimeZone(countryCode?: CountryCode) {
  const cc = (countryCode ?? "KR").toUpperCase();
  return COUNTRY_TO_TIMEZONE[cc] ?? "Asia/Seoul"; // fallback
}

export function Clock({ countryCode = "KR" }: { countryCode?: string }) {
  const [time, setTime] = useState<Date | null>(null);

  const timeZone = useMemo(() => getTimeZone(countryCode), [countryCode]);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  if (!time) return <div className="w-32 h-5 bg-muted/20 animate-pulse rounded" />;

  const formatted = time.toLocaleString("ko-KR", {
    timeZone, // ✅ 여기만 추가하면 됨
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="text-xs text-muted-foreground font-mono">
      {formatted}
    </div>
  );
}
