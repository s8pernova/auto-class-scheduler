import { FaStar } from "react-icons/fa";
import type { KeyboardEvent } from "react";
import type { ScheduleSummaryResponse } from "@/api";
import { formatTime } from "@/utils/scheduleResults";

type SavedSchedulesGridProps = {
    schedules: ScheduleSummaryResponse[];
    selectedSchedule: ScheduleSummaryResponse | null;
    onSelectSchedule: (scheduleId: number) => void;
    emptyMessage?: string;
};

const DAY_LABELS: Array<[keyof ScheduleSummaryResponse, string]> = [
    ["meets_mon", "Mon"],
    ["meets_tue", "Tue"],
    ["meets_wed", "Wed"],
    ["meets_thu", "Thu"],
    ["meets_fri", "Fri"],
    ["meets_sat", "Sat"],
];

function getMeetingDays(schedule: ScheduleSummaryResponse): string {
    const days = DAY_LABELS.filter(([key]) => Boolean(schedule[key])).map(
        ([, label]) => label,
    );

    return days.length > 0 ? days.join(", ") : "No meeting days";
}

function formatInstructorScore(score: number | null | undefined): string | null {
    return score == null ? null : `Instructor score ${score.toFixed(1)}`;
}

export default function SavedSchedulesGrid({
    schedules,
    selectedSchedule,
    onSelectSchedule,
    emptyMessage = "No favorite schedules yet.",
}: SavedSchedulesGridProps) {
    function handleCardKeyDown(
        event: KeyboardEvent<HTMLElement>,
        scheduleId: number,
    ): void {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        onSelectSchedule(scheduleId);
    }

    return (
        <main className="bg-surface rounded-[10px] p-[10px] overflow-y-auto">
            {schedules.length === 0 ? (
                <div className="h-full flex items-center justify-center text-background/50 text-sm">
                    {emptyMessage}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-[10px]">
                    {schedules.map((schedule) => {
                        const isSelected =
                            selectedSchedule?.schedule_id === schedule.schedule_id;
                        const instructorScore = formatInstructorScore(
                            schedule.total_instructor_score,
                        );

                        return (
                            <article
                                key={schedule.schedule_id}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    onSelectSchedule(schedule.schedule_id)
                                }
                                onKeyDown={(event) =>
                                    handleCardKeyDown(
                                        event,
                                        schedule.schedule_id,
                                    )
                                }
                                className={`text-left border rounded-[10px] p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent ${
                                    isSelected
                                        ? "border-accent bg-accent/10"
                                        : "border-background/10 bg-background/5 hover:border-background/30"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold text-background">
                                            <FaStar className="mr-2 inline text-yellow-500" />
                                            Schedule {schedule.schedule_id}
                                        </h3>
                                        <p className="text-xs text-background/60 mt-1">
                                            {schedule.total_credits} credits ·{" "}
                                            {schedule.num_sections} sections ·{" "}
                                            {getMeetingDays(schedule)}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm text-background/70">
                                        <p>
                                            {formatTime(schedule.earliest_start)} -{" "}
                                            {formatTime(schedule.latest_end)}
                                        </p>
                                        <p>{schedule.campus_pattern}</p>
                                    </div>
                                </div>
                                {instructorScore ? (
                                    <p className="mt-3 text-xs text-background/60">
                                        {instructorScore}
                                    </p>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
