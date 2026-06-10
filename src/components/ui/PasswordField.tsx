"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  helper?: string;
  required?: boolean;
  className?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  helper,
  required,
  className
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="relative mt-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          className="h-11 w-full rounded-lg border border-line bg-white px-4 pr-11 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-ink"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {helper ? <span className="mt-2 block text-xs text-muted">{helper}</span> : null}
    </label>
  );
}
