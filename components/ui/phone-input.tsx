"use client";

import { useEffect, useRef, useState } from "react";
import { NavArrowDown, Phone } from "iconoir-react";

export type CountryCode = {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
};

const COUNTRIES: CountryCode[] = [
  { code: "KE", dialCode: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "UG", dialCode: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "TZ", dialCode: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "RW", dialCode: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "NG", dialCode: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "ZA", dialCode: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "USA" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "UK" },
  { code: "GH", dialCode: "+233", flag: "🇬🇭", name: "Ghana" },
];

type PhoneInputProps = {
  label: string;
  value: string; // The full number e.g. +254712345678
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
};

export function PhoneInput({
  label,
  value,
  onChange,
  required,
  error,
  className = "",
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    COUNTRIES[0]!,
  );
  const [localNumber, setLocalNumber] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize from value if it starts with a known dial code
  useEffect(() => {
    if (value && !localNumber) {
      const country = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (country) {
        setSelectedCountry(country);
        setLocalNumber(value.replace(country.dialCode, ""));
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleCountrySelect(country: CountryCode) {
    setSelectedCountry(country);
    setIsOpen(false);
    onChange(country.dialCode + localNumber);
  }

  function handleLocalNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value.replace(/\D/g, "");
    setLocalNumber(newVal);
    onChange(selectedCountry.dialCode + newVal);
  }

  return (
    <div className={`block space-y-2 ${className}`}>
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div
        className={`flex h-12 items-stretch rounded-button border bg-surface-3 transition-[border-color,box-shadow] duration-200 focus-within:ring-1 ${
          error
            ? "border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20"
            : "border-border-default focus-within:border-brand-gold focus-within:ring-brand-gold/20"
        }`}
      >
        {/* Country Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-full items-center gap-1.5 border-r border-border-default px-3 transition-colors hover:bg-surface-4 active:bg-surface-2"
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm text-text-primary font-medium">
              {selectedCountry.dialCode}
            </span>
            <NavArrowDown className="h-3.5 w-3.5 text-text-muted" />
          </button>

          {isOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[200px] rounded-card border border-border-default bg-surface-3 py-1 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1 space-y-0.5">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-gold/10 hover:text-brand-gold ${
                      selectedCountry.code === country.code
                        ? "bg-brand-gold/10 text-brand-gold font-medium"
                        : "text-text-secondary"
                    }`}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="text-text-muted text-xs tabular-nums">
                      {country.dialCode}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Local Number Input */}
        <div className="flex flex-1 items-center gap-2 px-3">
          <Phone className="h-4 w-4 text-text-muted" />
          <input
            type="tel"
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:text-text-disabled"
            placeholder="700 000 000"
            value={localNumber}
            onChange={handleLocalNumberChange}
            required={required}
          />
        </div>
      </div>
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
