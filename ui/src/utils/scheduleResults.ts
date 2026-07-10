import type { GeneratedScheduleResponse } from "@/api";

export type SortKey =
    | "earliestStart"
    | "latestEnd"
    | "numMeetingDays"
    | "totalGapMinutes"
    | "averageInstructorRating";

export type DayFilter = "all" | "M" | "T" | "W" | "R" | "F" | "S";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "earliestStart", label: "Earliest start" },
    { value: "latestEnd", label: "Earliest finish" },
    { value: "numMeetingDays", label: "Fewest meeting days" },
    { value: "totalGapMinutes", label: "Least total gap" },
    { value: "averageInstructorRating", label: "Instructor rating" },
];

export const DAY_FILTERS: { value: DayFilter; label: string }[] = [
    { value: "all", label: "No day restriction" },
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

function doesScheduleMeetOnDay(
    schedule: GeneratedScheduleResponse,
    dayFilter: Exclude<DayFilter, "all">,
): boolean {
    switch (dayFilter) {
        case "M":
            return schedule.meetsMon;
        case "T":
            return schedule.meetsTue;
        case "W":
            return schedule.meetsWed;
        case "R":
            return schedule.meetsThu;
        case "F":
            return schedule.meetsFri;
        case "S":
            return schedule.meetsSat;
    }
}

export function filterSchedulesByExcludedDay(
    schedules: GeneratedScheduleResponse[],
    dayFilter: DayFilter,
): GeneratedScheduleResponse[] {
    if (dayFilter === "all") {
        return schedules;
    }
    return schedules.filter((schedule) => !doesScheduleMeetOnDay(schedule, dayFilter));
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
            case "numMeetingDays":
                return (
                    scheduleDayCount(first) - scheduleDayCount(second) ||
                    first.earliestStart.localeCompare(second.earliestStart)
                );
            case "totalGapMinutes":
                return first.resultId.localeCompare(second.resultId);
            case "averageInstructorRating":
                return (
                    compareNullableScores(
                        first.totalInstructorScore,
                        second.totalInstructorScore,
                    ) || first.earliestStart.localeCompare(second.earliestStart)
                );
        }
    });
}
