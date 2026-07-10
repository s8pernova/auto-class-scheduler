import type {
    GeneratedScheduleResponse,
    ScheduleGenerationSessionSort,
} from "@/api";

export type SortKey = NonNullable<ScheduleGenerationSessionSort["field"]>;
export type SortDirection = NonNullable<
    ScheduleGenerationSessionSort["direction"]
>;
export type MeetingDayCode = "M" | "T" | "W" | "R" | "F" | "S";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "earliestStart", label: "Earliest start" },
    { value: "latestEnd", label: "Earliest finish" },
    { value: "numMeetingDays", label: "Fewest meeting days" },
    { value: "totalGapMinutes", label: "Least total gap" },
    { value: "averageInstructorRating", label: "Instructor rating" },
];

export const DAY_OPTIONS: { value: MeetingDayCode; label: string }[] = [
    { value: "M", label: "Avoid Monday" },
    { value: "T", label: "Avoid Tuesday" },
    { value: "W", label: "Avoid Wednesday" },
    { value: "R", label: "Avoid Thursday" },
    { value: "F", label: "Avoid Friday" },
    { value: "S", label: "Avoid Saturday" },
];

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
