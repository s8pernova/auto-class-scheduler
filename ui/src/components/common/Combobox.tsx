import { useMemo } from "react";
import CreatableSelect from "react-select/creatable";
import type { StylesConfig } from "react-select";

type Option = {
    label: string;
    value: string;
};

const comboboxStyles: StylesConfig<Option, false> = {
    control: (base, state) => ({
        ...base,
        background: "transparent",
        border: state.isFocused
            ? "1px solid var(--accent)"
            : "1px solid transparent",
        borderRadius: "0.25rem",
        boxShadow: "none",
        minHeight: "unset",
        padding: "0",
        fontSize: "0.875rem",
        cursor: "text",
        "&:hover": {
            border: state.isFocused
                ? "1px solid var(--accent)"
                : "1px solid color-mix(in srgb, var(--bg) 20%, transparent)",
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: "0.25rem 0.5rem",
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        color: "var(--bg)",
    }),
    singleValue: (base) => ({
        ...base,
        color: "var(--bg)",
    }),
    placeholder: (base) => ({
        ...base,
        color: "color-mix(in srgb, var(--bg) 40%, transparent)",
    }),
    indicatorsContainer: (base) => ({
        ...base,
        "& > div": {
            padding: "2px 4px",
        },
    }),
    dropdownIndicator: (base) => ({
        ...base,
        color: "color-mix(in srgb, var(--bg) 30%, transparent)",
        "&:hover": {
            color: "color-mix(in srgb, var(--bg) 60%, transparent)",
        },
    }),
    clearIndicator: (base) => ({
        ...base,
        color: "color-mix(in srgb, var(--bg) 30%, transparent)",
        "&:hover": {
            color: "color-mix(in srgb, var(--bg) 60%, transparent)",
        },
    }),
    indicatorSeparator: () => ({
        display: "none",
    }),
    menu: (base) => ({
        ...base,
        background: "var(--surface)",
        border: "1px solid color-mix(in srgb, var(--bg) 20%, transparent)",
        borderRadius: "0.375rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 20,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.875rem",
        padding: "0.375rem 0.5rem",
        background: state.isFocused
            ? "color-mix(in srgb, var(--bg) 10%, transparent)"
            : "transparent",
        color: "var(--bg)",
        cursor: "pointer",
        "&:active": {
            background: "color-mix(in srgb, var(--bg) 15%, transparent)",
        },
    }),
    noOptionsMessage: (base) => ({
        ...base,
        fontSize: "0.875rem",
        color: "color-mix(in srgb, var(--bg) 50%, transparent)",
    }),
};

function normalizeString(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (s) => s.toUpperCase());
}

type ComboboxProps = {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    onCreateOption?: (value: string) => void;
    placeholder?: string;
};

export function Combobox({
    value,
    options,
    onChange,
    onCreateOption,
    placeholder = "Type or select...",
}: ComboboxProps) {
    const selectOptions = useMemo<Option[]>(
        () =>
            options.map((option) => ({
                label: option,
                value: option,
            })),
        [options],
    );

    const selectedOption = value
        ? {
              label: value,
              value,
          }
        : null;

    function handleCreate(rawValue: string) {
        const nextValue = normalizeString(rawValue);

        if (!nextValue) return;

        onCreateOption?.(nextValue);
        onChange(nextValue);
    }

    return (
        <CreatableSelect
            isClearable
            styles={comboboxStyles}
            value={selectedOption}
            options={selectOptions}
            placeholder={placeholder}
            onChange={(option) => {
                onChange(option?.value ?? "");
            }}
            onCreateOption={handleCreate}
        />
    );
}
