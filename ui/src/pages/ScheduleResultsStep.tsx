import { useMemo, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import type { GeneratedScheduleResponse } from "@/api/client";
import { useScheduleDraft } from "@/contexts/ScheduleDraftContext";

type SortKey = "earliestStart" | "latestEnd" | "instructorScore";
type DayFilter =
    | "all"
    | "meetsMon"
    | "meetsTue"
    | "meetsWed"
    | "meetsThu"
    | "meetsFri"
    | "meetsSat";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "earliestStart", label: "Earliest start" },
    { value: "latestEnd", label: "Earliest finish" },
    { value: "instructorScore", label: "Instructor score" },
];

const DAY_FILTERS: { value: DayFilter; label: string }[] = [
    { value: "all", label: "Any day" },
    { value: "meetsMon", label: "Monday" },
    { value: "meetsTue", label: "Tuesday" },
    { value: "meetsWed", label: "Wednesday" },
    { value: "meetsThu", label: "Thursday" },
    { value: "meetsFri", label: "Friday" },
    { value: "meetsSat", label: "Saturday" },
];
const EMPTY_SCHEDULES: GeneratedScheduleResponse[] = [];

function formatTime(value: string): string {
    const [hoursText = "0", minutes = "00"] = value.split(":");
    const hours = Number(hoursText);

    if (!Number.isFinite(hours)) {
        return value;
    }

    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.padStart(2, "0")} ${suffix}`;
}

function scheduleDayCount(schedule: GeneratedScheduleResponse): number {
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

function sortSchedules(
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

export default function ScheduleResultsStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft } = useScheduleDraft();
    const navigate = useNavigate();
    const [sortKey, setSortKey] = useState<SortKey>("earliestStart");
    const [dayFilter, setDayFilter] = useState<DayFilter>("all");
    const [selectedResultId, setSelectedResultId] = useState<string | null>(
        null,
    );
    const generationResult = draft.generationResult;
    const allSchedules = generationResult?.schedules ?? EMPTY_SCHEDULES;
    const visibleSchedules = useMemo(() => {
        const filtered = allSchedules.filter((schedule) => {
            const matchesDay =
                dayFilter === "all" ? true : Boolean(schedule[dayFilter]);

            return matchesDay;
        });

        return sortSchedules(filtered, sortKey);
    }, [allSchedules, dayFilter, sortKey]);
    const selectedSchedule =
        visibleSchedules.find(
            (schedule) => schedule.resultId === selectedResultId,
        ) ??
        visibleSchedules[0] ??
        null;

    if (draft.requirementCourses.length === 0) {
        return <Navigate to={`/catalogs/${catalogId}/build`} replace />;
    }

    if (!generationResult) {
        return <Navigate to={`/catalogs/${catalogId}/instructors`} replace />;
    }

    function handleBack() {
        navigate(`/catalogs/${catalogId}/instructors`);
    }

    return (
        <>
            <aside className="bg-surface rounded-[10px] p-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Filters
                </h2>
                <div className="text-sm text-background/70 space-y-4">
                    <label className="block">
                        <span className="block text-xs font-semibold text-background/50 uppercase tracking-wide mb-1">
                            Sort by
                        </span>
                        <select
                            value={sortKey}
                            onChange={(event) =>
                                setSortKey(event.target.value as SortKey)
                            }
                            className="w-full rounded-md border border-background/20 bg-surface px-2 py-1 text-background focus:border-accent outline-none"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold text-background/50 uppercase tracking-wide mb-1">
                            Meets on
                        </span>
                        <select
                            value={dayFilter}
                            onChange={(event) =>
                                setDayFilter(event.target.value as DayFilter)
                            }
                            className="w-full rounded-md border border-background/20 bg-surface px-2 py-1 text-background focus:border-accent outline-none"
                        >
                            {DAY_FILTERS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="border-t border-background/10 pt-3 space-y-1">
                        <p>{generationResult.validCount} valid schedules</p>
                        <p>{visibleSchedules.length} visible after filters</p>
                    </div>
                </div>
            </aside>

            <main className="bg-surface rounded-[10px] p-[10px] overflow-y-auto">
                {visibleSchedules.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-background/50 text-sm">
                        No valid schedules matched these constraints.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-[10px]">
                        {visibleSchedules.map((schedule) => (
                            <button
                                type="button"
                                key={schedule.resultId}
                                onClick={() =>
                                    setSelectedResultId(schedule.resultId)
                                }
                                className={`text-left border rounded-[10px] p-4 transition-colors ${
                                    selectedSchedule?.resultId ===
                                    schedule.resultId
                                        ? "border-accent bg-accent/10"
                                        : "border-background/10 bg-background/5 hover:border-background/30"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold text-background">
                                            Schedule {schedule.resultId}
                                        </h3>
                                        <p className="text-xs text-background/60 mt-1">
                                            {scheduleDayCount(schedule)} meeting
                                            days
                                        </p>
                                    </div>
                                    <div className="text-right text-sm text-background/70">
                                        <p>
                                            {formatTime(schedule.earliestStart)}{" "}
                                            - {formatTime(schedule.latestEnd)}
                                        </p>
                                        {schedule.totalInstructorScore !=
                                        null ? (
                                            <p>
                                                Score{" "}
                                                {schedule.totalInstructorScore}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-2">
                                    {schedule.sections.map((section) => (
                                        <div
                                            key={`${schedule.resultId}-${section.courseName}-${section.sectionCode}`}
                                            className="rounded-md border border-background/10 px-3 py-2 text-sm"
                                        >
                                            <div className="font-semibold text-background">
                                                {section.courseName}-{" "}
                                                {section.sectionCode}
                                            </div>
                                            <div className="text-background/60">
                                                {section.instructorName ||
                                                    "Instructor TBD"}
                                            </div>
                                            <div className="text-xs text-background/50 mt-1">
                                                {section.meetings
                                                    .map(
                                                        (meeting) =>
                                                            `${meeting.dayOfWeek} ${formatTime(
                                                                meeting.startTime,
                                                            )}-${formatTime(
                                                                meeting.endTime,
                                                            )}`,
                                                    )
                                                    .join(", ")}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>

            <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-1">
                    Details
                </h2>
                <div className="text-sm text-background/70 space-y-2">
                    <p>{generationResult.candidateCount} total combinations</p>
                    <p>{generationResult.validCount} passed filters</p>
                </div>
                {selectedSchedule ? (
                    <div className="min-h-0 overflow-y-auto border-t border-background/10 pt-4">
                        <h3 className="font-semibold text-background mb-2">
                            {selectedSchedule.resultId}
                        </h3>
                        <div className="text-sm text-background/70 space-y-1 mb-4">
                            <p>
                                {formatTime(selectedSchedule.earliestStart)} -{" "}
                                {formatTime(selectedSchedule.latestEnd)}
                            </p>
                            {selectedSchedule.totalInstructorScore != null ? (
                                <p>
                                    Instructor score{" "}
                                    {selectedSchedule.totalInstructorScore}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-col gap-3">
                            {selectedSchedule.sections.map((section) => (
                                <div
                                    key={`${selectedSchedule.resultId}-detail-${section.courseName}-${section.sectionCode}`}
                                    className="border border-background/10 rounded-md p-3 text-sm"
                                >
                                    <p className="font-semibold text-background">
                                        {section.courseName}-{" "}
                                        {section.sectionCode}
                                    </p>
                                    <p className="text-background/60">
                                        {section.instructorName ||
                                            "Instructor TBD"}
                                    </p>
                                    <div className="mt-2 space-y-1 text-xs text-background/55">
                                        {section.meetings.map((meeting) => (
                                            <p
                                                key={`${meeting.dayOfWeek}-${meeting.startTime}-${meeting.endTime}`}
                                            >
                                                {meeting.dayOfWeek}{" "}
                                                {formatTime(meeting.startTime)}
                                                {" - "}
                                                {formatTime(meeting.endTime)}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div className="mt-auto">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="w-full px-4 py-2 border border-background/20 text-background rounded-md font-semibold hover:bg-background/5 transition-colors"
                    >
                        Back to Instructors
                    </button>
                </div>
            </aside>
        </>
    );
}
