"use client";

import { useMemo } from "react";
import * as flags from "country-flag-icons/react/3x2";

interface CountryFlagProps {
  countryCode?: string | null;
  className?: string;
  size?: number;
}

/**
 * CountryFlag component displays a country flag icon based on ISO 3166-1 alpha-2 country code
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "KR", "US", "JP")
 * @param className - Additional CSS classes
 * @param size - Size in pixels (default: 16)
 */
export function CountryFlag({ countryCode, className = "", size = 16 }: CountryFlagProps) {
  const FlagComponent = useMemo(() => {
    if (!countryCode) return null;
    
    // Convert to uppercase to match the flag component names
    const code = countryCode.toUpperCase();
    
    // Get the flag component dynamically
    // @ts-ignore - Dynamic access to flag components
    const Flag = flags[code];
    
    return Flag || null;
  }, [countryCode]);

  if (!FlagComponent) return null;

  return (
    <FlagComponent 
      className={`inline-block rounded-sm ${className}`}
      style={{ width: size, height: size * 0.67 }} // 3x2 aspect ratio
      title={countryCode?.toUpperCase()}
    />
  );
}
