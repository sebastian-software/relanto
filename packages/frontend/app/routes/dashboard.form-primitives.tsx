/* cspell:ignore sonarjs */
/* eslint-disable @typescript-eslint/strict-boolean-expressions, complexity, no-nested-ternary, sonarjs/cognitive-complexity -- Extracted legacy form primitives preserve existing nullable prop behavior. */
import type React from "react";

import {
  buttonVariants,
  checkboxField,
  checkboxInput,
  control,
  controlInvalid,
  field,
  fieldError,
  fieldHint,
  fieldLabel,
  selectControl,
} from "./dashboard.css";

export function LabeledInput({
  autoComplete,
  error,
  hint,
  label,
  name,
  onChange,
  type = "text",
  value,
}: {
  autoComplete?: string;
  error?: string;
  hint?: string;
  label: React.ReactNode;
  name: string;
  onChange?: (value: string) => void;
  type?: string;
  value: number | string;
}): React.JSX.Element {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <label className={field}>
      <span className={fieldLabel}>{label}</span>
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className={error ? `${control} ${controlInvalid}` : control}
        name={name}
        onChange={
          onChange
            ? (event) => {
                onChange(event.currentTarget.value);
              }
            : undefined
        }
        type={type}
        {...(onChange ? { value } : { defaultValue: value })}
      />
      {hint ? (
        <span className={fieldHint} id={`${name}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className={fieldError} id={`${name}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function LabeledSelect({
  disabled = false,
  error,
  label,
  name,
  onChange,
  options,
  placeholder,
  value,
}: {
  disabled?: boolean;
  error?: string;
  label: React.ReactNode;
  name: string;
  onChange?: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  value?: string;
}): React.JSX.Element {
  const describedBy = error ? `${name}-error` : undefined;

  return (
    <label className={field}>
      <span className={fieldLabel}>{label}</span>
      <select
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={error ? `${selectControl} ${controlInvalid}` : selectControl}
        disabled={disabled}
        name={name}
        onChange={
          onChange
            ? (event) => {
                onChange(event.currentTarget.value);
              }
            : undefined
        }
        {...(onChange ? { value: value ?? "" } : { defaultValue: value ?? "" })}
      >
        {placeholder ? (
          <option disabled value="">
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className={fieldError} id={`${name}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function CheckboxInput({
  checked,
  label,
  name,
}: {
  checked: boolean;
  label: React.ReactNode;
  name: string;
}): React.JSX.Element {
  return (
    <label className={checkboxField}>
      <input className={checkboxInput} defaultChecked={checked} name={name} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

export function PrimaryButton({
  disabled = false,
  label,
  pending = false,
  pendingLabel,
}: {
  disabled?: boolean;
  label: React.ReactNode;
  pending?: boolean;
  pendingLabel?: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      aria-busy={pending}
      className={buttonVariants.primary}
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}
