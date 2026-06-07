import type { GeneratedScheduleResponse } from "@/api";

export type SortKey = "earliestStart" | "latestEnd" | "instructorScore";

export type DayFilter =
    | "all"
    | "meetsMon"
    | "meetsTue"
    | "meetsWed"
    | "meetsThu"
    | "meetsFri"
    | "meetsSat";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "earliestStart", label: "Earliest start" },
    { value: "latestEnd", label: "Earliest finish" },
    { value: "instructorScore", label: "Instructor score" },
];

export const DAY_FILTERS: { value: DayFilter; label: string }[] = [
    { value: "all", label: "Any day" },
    { value: "meetsMon", label: "Monday" },
    { value: "meetsTue", label: "Tuesday" },
    { value: "meetsWed", label: "Wednesday" },
    { value: "meetsThu", label: "Thursday" },
    { value: "meetsFri", label: "Friday" },
    { value: "meetsSat", label: "Saturday" },
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
    return [
        schedule.meetsMon,
        schedule.meetsTue,
        schedule.meetsWed,
        schedule.meetsThu,
        schedule.meetsFri,
        schedule.meetsSat,
    ].filter(Boolean).length;
}

function compareNullableScores(
    first: number | null | undefined,
    second: number | null | undefined,
): number {
    if (first == null && second == null) return 0;
    if (first == null) return 1;
    if (second == null) return -1;
    return second - first;
}

export function sortSchedules(
    schedules: GeneratedScheduleResponse[],
    sortKey: SortKey,
): GeneratedScheduleResponse[] {
    return [...schedules].sort((first, second) => {
        switch (sortKey) {
            case "earliestStart":
                return (
                    first.earliestStart.localeCompare(second.earliestStart) ||
                    first.latestEnd.localeCompare(second.latestEnd)
                );
            case "latestEnd":
                return (
                    first.latestEnd.localeCompare(second.latestEnd) ||
                    first.earliestStart.localeCompare(second.earliestStart)
                );
            case "instructorScore":
                return (
                    compareNullableScores(
                        first.totalInstructorScore,
                        second.totalInstructorScore,
                    ) || first.earliestStart.localeCompare(second.earliestStart)
                );
        }
    });
}
