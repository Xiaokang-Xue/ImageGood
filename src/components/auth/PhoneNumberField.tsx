"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, phoneDigits } from "@/config/phone-countries";
import { cn } from "@/lib/utils";

interface PhoneNumberFieldProps {
  countryCode: string;
  value: string;
  onCountryChange: (countryCode: string) => void;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PhoneNumberField({
  countryCode,
  value,
  onCountryChange,
  onChange,
  label = "手机号",
  required,
  disabled,
  className
}: PhoneNumberFieldProps) {
  const country = PHONE_COUNTRIES.find((item) => item.code === countryCode) || DEFAULT_PHONE_COUNTRY;

  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-semibold text-neutral-800">{label}</span>
      <div className="mt-2 flex h-11 overflow-hidden rounded-md border border-neutral-300 bg-white transition focus-within:border-neutral-950 focus-within:ring-2 focus-within:ring-neutral-950/10">
        <select
          value={country.code}
          onChange={(event) => onCountryChange(event.target.value)}
          disabled={disabled}
          aria-label="国家或地区"
          className="w-[132px] shrink-0 border-0 border-r border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-800 outline-none sm:w-[148px]"
        >
          {PHONE_COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} {item.dialCode}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 flex-1 items-center">
          <span className="pl-3 text-sm font-medium text-neutral-500">{country.dialCode}</span>
          <input
            value={value}
            onChange={(event) => onChange(phoneDigits(event.target.value).slice(0, country.maxLength))}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={country.placeholder}
            required={required}
            disabled={disabled}
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>
    </label>
  );
}
