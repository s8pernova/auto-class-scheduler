import { FaStar } from "react-icons/fa";
import type { MouseEvent } from "react";
import type { GeneratedScheduleResponse } from "@/api";
import { formatTime, scheduleDayCount } from "@/utils/scheduleResults";

type ResultsGridProps = {
    schedules: GeneratedScheduleResponse[];
    selectedSchedule: GeneratedScheduleResponse | null;
    onSelectSchedule: (resultId: string) => void;
    onFavorite: (
        event: MouseEvent<HTMLButtonElement>,
        schedule: GeneratedScheduleResponse,
    ) => void;
};

export default function ResultsGrid({
    schedules,
    selectedSchedule,
    onSelectSchedule,
    onFavorite,
}: ResultsGridProps) {
    return (
        <main className="bg-surface rounded-[10px] p-[10px] overflow-y-auto">
            {schedules.length === 0 ? (
                <div className="h-full flex items-center justify-center text-background/50 text-sm">
                    No valid schedules matched these constraints.
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-[10px]">
                    {schedules.map((schedule) => (
                        <button
                            type="button"
                            key={schedule.resultId}
                            onClick={() => onSelectSchedule(schedule.resultId)}
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
                                        {scheduleDayCount(schedule)} meeting days
                                    </p>
                                </div>
                                <div className="text-right text-sm text-background/70">
                                    <p>
                                        {formatTime(schedule.earliestStart)} -{" "}
                                        {formatTime(schedule.latestEnd)}
                                    </p>
                                    {schedule.totalInstructorScore != null ? (
                                        <p>
                                            Score{" "}
                                            {schedule.totalInstructorScore}
                                        </p>
                                    ) : null}
                                </div>

                                <button
                                    className=""
                                    onClick={(event) =>
                                        onFavorite(event, schedule)
                                    }
                                >
                                    <FaStar />
                                </button>
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
    );
}
