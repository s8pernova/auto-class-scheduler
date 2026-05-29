import type { ReactElement } from "react";

type DayOption = {
    label: string;
    value: string;
    name: string;
};

const DAY_OPTIONS: readonly DayOption[] = [
    { label: "M", value: "M", name: "Monday" },
    { label: "T", value: "T", name: "Tuesday" },
    { label: "W", value: "W", name: "Wednesday" },
    { label: "R", value: "R", name: "Thursday" },
    { label: "F", value: "F", name: "Friday" },
    { label: "S", value: "S", name: "Saturday" },
] as const;

function normalizeMeetingDays(value: string): string {
    const selected = new Set(value.toUpperCase().replace(/\s+/g, "").split(""));

    return DAY_OPTIONS.filter((day) => selected.has(day.value))
        .map((day) => day.value)
        .join("");
}

export type DaysInputProps = {
    value: string;
    onChange: (value: string) => void;
};

export function DaysInput({ value, onChange }: DaysInputProps): ReactElement {
    const normalizedValue = normalizeMeetingDays(value);
    const selectedDays = new Set(normalizedValue.split(""));

    function handleToggle(dayValue: string): void {
        const nextDays = new Set(selectedDays);

        if (nextDays.has(dayValue)) {
            nextDays.delete(dayValue);
        } else {
            nextDays.add(dayValue);
        }

        onChange(
            DAY_OPTIONS.filter((day) => nextDays.has(day.value))
                .map((day) => day.value)
                .join(""),
        );
    }

    return (
        <div
            className="inline-flex rounded border border-transparent hover:border-background/20 focus-within:border-accent"
            role="group"
            aria-label="Meeting days"
        >
            {DAY_OPTIONS.map((day) => {
                const isSelected = selectedDays.has(day.value);

                return (
                    <button
                        key={day.value}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={day.name}
                        title={day.name}
                        onClick={() => handleToggle(day.value)}
                        className={
                            isSelected
                                ? "min-w-8 px-2 py-1 text-sm font-semibold text-surface bg-accent"
                                : "min-w-8 px-2 py-1 text-sm text-background/65 hover:text-background hover:bg-background/10"
                        }
                    >
                        {day.label}
                    </button>
                );
            })}
        </div>
    );
}
