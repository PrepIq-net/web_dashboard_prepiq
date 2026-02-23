"use client";

import { useRef } from "react";

type OtpInputProps = {
  value: string;
  length?: number;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function OtpInput({
  value,
  length = 6,
  onChange,
  disabled = false,
}: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function setDigitAt(index: number, digit: string) {
    const next = value.padEnd(length, " ").split("");
    next[index] = digit;
    onChange(next.join("").trimEnd());
  }

  function focusAt(index: number) {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }

  function handleChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    setDigitAt(index, digit);

    if (digit && index < length - 1) {
      focusAt(index + 1);
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      setDigitAt(index - 1, "");
      focusAt(index - 1);
      event.preventDefault();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      focusAt(index - 1);
      event.preventDefault();
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      focusAt(index + 1);
      event.preventDefault();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) {
      return;
    }

    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    focusAt(focusIndex);
    event.preventDefault();
  }

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputRefs.current[index] = node;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onPaste={handlePaste}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className="h-12 w-11 rounded-button border border-border-default bg-surface-2 text-center text-lg font-display text-text-primary transition-[border-color,box-shadow] duration-200 outline-none focus:border-brand-gold focus:shadow-[0_0_0_1px_rgba(168,130,31,0.45)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-12"
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
