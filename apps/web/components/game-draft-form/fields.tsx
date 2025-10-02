"use client";

import { type ChangeEvent, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const baseLabelClass = "block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400";
const baseInputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none";

interface WithHelperText {
  helperText?: string;
  helperTextClassName?: string;
}

interface DraftInputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">,
    WithHelperText {
  label: string;
  onValueChange?: (value: string) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function DraftInputField({
  id,
  label,
  helperText,
  helperTextClassName,
  className,
  onValueChange,
  onChange,
  ...props
}: DraftInputFieldProps): JSX.Element {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (onValueChange) {
      onValueChange(event.target.value);
    }
  };

  return (
    <div>
      <label htmlFor={id} className={baseLabelClass}>
        {label}
      </label>
      <input
        id={id}
        {...props}
        onChange={handleChange}
        className={[baseInputClass, className].filter(Boolean).join(" ")}
      />
      {helperText ? (
        <p className={`mt-1 text-xs ${helperTextClassName ?? "text-slate-400"}`}>{helperText}</p>
      ) : null}
    </div>
  );
}

interface DraftTextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange">,
    WithHelperText {
  label: string;
  onValueChange?: (value: string) => void;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

export function DraftTextareaField({
  id,
  label,
  helperText,
  helperTextClassName,
  className,
  onValueChange,
  onChange,
  ...props
}: DraftTextareaFieldProps): JSX.Element {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    if (onValueChange) {
      onValueChange(event.target.value);
    }
  };

  return (
    <div>
      <label htmlFor={id} className={baseLabelClass}>
        {label}
      </label>
      <textarea
        id={id}
        {...props}
        onChange={handleChange}
        className={[baseInputClass, className].filter(Boolean).join(" ")}
      />
      {helperText ? (
        <p className={`mt-1 text-xs ${helperTextClassName ?? "text-slate-400"}`}>{helperText}</p>
      ) : null}
    </div>
  );
}

interface DraftSelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange">,
    WithHelperText {
  label: string;
  onValueChange?: (value: string) => void;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}

export function DraftSelectField({
  id,
  label,
  helperText,
  helperTextClassName,
  className,
  onValueChange,
  onChange,
  ...props
}: DraftSelectFieldProps): JSX.Element {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange?.(event);
    if (onValueChange) {
      onValueChange(event.target.value);
    }
  };

  return (
    <div>
      <label htmlFor={id} className={baseLabelClass}>
        {label}
      </label>
      <select
        id={id}
        {...props}
        onChange={handleChange}
        className={[baseInputClass, className].filter(Boolean).join(" ")}
      />
      {helperText ? (
        <p className={`mt-1 text-xs ${helperTextClassName ?? "text-slate-400"}`}>{helperText}</p>
      ) : null}
    </div>
  );
}

interface LightningAddressFieldProps extends Omit<DraftInputFieldProps, "label"> {}

export function LightningAddressField(props: LightningAddressFieldProps): JSX.Element {
  return (
    <DraftInputField
      {...props}
      label="Lightning address for payouts"
      helperText="We automatically send 85% of each confirmed purchase to this address and retain 15% for platform upkeep."
    />
  );
}
