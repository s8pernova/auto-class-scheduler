import { useMemo } from "react";
import CreatableSelect from "react-select/creatable";

type Option = {
    label: string;
    value: string;
};

function normalizeString(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

type CreatableComboboxProps = {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    onCreateOption?: (value: string) => void;
    placeholder?: string;
};

export function CreatableCombobox({
    value,
    options,
    onChange,
    onCreateOption,
    placeholder = "Type or select...",
}: CreatableComboboxProps) {
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
