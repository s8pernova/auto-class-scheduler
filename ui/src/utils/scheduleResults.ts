import type {
    GeneratedScheduleResponse,
    ScheduleGenerationSessionSort,
} from "@/api";

export type SortKey = NonNullable<ScheduleGenerationSessionSort["field"]>;
export type SortDirection = NonNullable<
    ScheduleGenerationSessionSort["direction"]
>;
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "earliestStart", label: "Earliest start" },
    { value: "latestEnd", label: "Earliest finish" },
    { value: "numMeetingDays", label: "Fewest meeting days" },
    { value: "totalGapMinutes", label: "Least total gap" },
    { value: "averageInstructorRating", label: "Instructor rating" },
];

export const MEETING_DAY_OPTIONS = [
    { value: "M", shortLabel: "M", label: "Monday" },
    { value: "T", shortLabel: "T", label: "Tuesday" },
    { value: "W", shortLabel: "W", label: "Wednesday" },
    { value: "R", shortLabel: "R", label: "Thursday" },
    { value: "F", shortLabel: "F", label: "Friday" },
    { value: "S", shortLabel: "S", label: "Saturday" },
] as const;

export type MeetingDayCode = (typeof MEETING_DAY_OPTIONS)[number]["value"];

const MEETING_DAY_CODES = new Set<string>(
    MEETING_DAY_OPTIONS.map((day) => day.value),
);

export function isMeetingDay(value: string): value is MeetingDayCode {
    return MEETING_DAY_CODES.has(value);
}

export function normalizeMeetingDay(value: string): MeetingDayCode | null {
    const normalizedValue = value.trim().toLowerCase();
    const matchingDay = MEETING_DAY_OPTIONS.find(
        (day) =>
            day.value.toLowerCase() === normalizedValue ||
            day.label.toLowerCase() === normalizedValue ||
            day.label.slice(0, 3).toLowerCase() === normalizedValue,
    );

    return matchingDay?.value ?? null;
}

export function normalizeMeetingDayCodes(value: string): MeetingDayCode[] {
    const selectedDays = new Set(
        Array.from(value.toUpperCase()).filter(isMeetingDay),
    );

    return MEETING_DAY_OPTIONS.filter((day) => selectedDays.has(day.value)).map(
        (day) => day.value,
    );
}

export function formatMeetingDay(value: string): string {
    const normalizedDay = normalizeMeetingDay(value);
    return (
        MEETING_DAY_OPTIONS.find((day) => day.value === normalizedDay)?.label ??
        value
    );
}

export function formatTime(value: string): string {
    const [hoursText = "0", minutes = "00"] = value.split(":");
    const hours = Number(hoursText);

    if (!Number.isFinite(hours)) {
        return value;
    }

    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.padStart(2, "0")} ${suffix}`;
}

export function scheduleDayCount(schedule: GeneratedScheduleResponse): number {
    return schedule.summary.numMeetingDays;
}
