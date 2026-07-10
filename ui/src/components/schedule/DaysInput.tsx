import type { ReactElement } from "react";
import {
    MEETING_DAY_OPTIONS,
    normalizeMeetingDayCodes,
    type MeetingDayCode,
} from "@/utils/scheduleResults";

function normalizeMeetingDays(value: string): string {
    return normalizeMeetingDayCodes(value).join("");
}

export type DaysInputProps = {
    value: string;
    onChange: (value: string) => void;
};

export function DaysInput({ value, onChange }: DaysInputProps): ReactElement {
    const normalizedValue = normalizeMeetingDays(value);
    const selectedDays = new Set(normalizedValue.split(""));

    function handleToggle(dayValue: MeetingDayCode): void {
        const nextDays = new Set(selectedDays);

        if (nextDays.has(dayValue)) {
            nextDays.delete(dayValue);
        } else {
            nextDays.add(dayValue);
        }

        onChange(
            MEETING_DAY_OPTIONS.filter((day) => nextDays.has(day.value))
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
            {MEETING_DAY_OPTIONS.map((day) => {
                const isSelected = selectedDays.has(day.value);

                return (
                    <button
                        key={day.value}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={day.label}
                        title={day.label}
                        onClick={() => handleToggle(day.value)}
                        className={
                            isSelected
                                ? "min-w-8 px-2 py-1 text-sm font-semibold text-surface bg-accent"
                                : "min-w-8 px-2 py-1 text-sm text-background/65 hover:text-background hover:bg-background/10"
                        }
                    >
                        {day.shortLabel}
                    </button>
                );
            })}
        </div>
    );
}
