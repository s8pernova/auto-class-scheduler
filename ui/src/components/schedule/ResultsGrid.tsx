import { FaStar } from "react-icons/fa";
import type { KeyboardEvent, MouseEvent } from "react";
import type { GeneratedScheduleResponse } from "@/api";
import { formatTime } from "@/utils/scheduleResults";

type ResultFavoriteState = {
    scheduleId: number | null;
    isSaving: boolean;
    error: string | null;
};

type ResultsGridProps = {
    schedules: GeneratedScheduleResponse[];
    selectedSchedule: GeneratedScheduleResponse | null;
    onSelectSchedule: (resultId: string) => void;
    onFavorite: (
        event: MouseEvent<HTMLButtonElement>,
        schedule: GeneratedScheduleResponse,
    ) => void;
    favoriteStates?: Record<string, ResultFavoriteState | undefined>;
};

export default function ResultsGrid({
    schedules,
    selectedSchedule,
    onSelectSchedule,
    onFavorite,
    favoriteStates = {},
}: ResultsGridProps) {
    function handleCardKeyDown(
        event: KeyboardEvent<HTMLElement>,
        resultId: string,
    ): void {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        onSelectSchedule(resultId);
    }

    return (
        <main className="bg-surface rounded-[10px] p-[10px] overflow-y-auto">
            {schedules.length === 0 ? (
                <div className="h-full flex items-center justify-center text-background/50 text-sm">
                    No valid schedules matched these constraints.
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-[10px]">
                    {schedules.map((schedule) => {
                        const favoriteState = favoriteStates[schedule.resultId];
                        const isFavorited = Boolean(favoriteState?.scheduleId);
                        const isSavingFavorite = Boolean(
                            favoriteState?.isSaving,
                        );

                        return (
                            <article
                                key={schedule.resultId}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    onSelectSchedule(schedule.resultId)
                                }
                                onKeyDown={(event) =>
                                    handleCardKeyDown(event, schedule.resultId)
                                }
                                className={`text-left border rounded-[10px] p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent ${
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
                                            {schedule.summary.numMeetingDays}{" "}
                                            meeting days ·{" "}
                                            {schedule.summary.totalGapMinutes}{" "}
                                            gap minutes
                                        </p>
                                    </div>
                                    <div className="text-right text-sm text-background/70">
                                        <p>
                                            {formatTime(
                                                schedule.summary.earliestStart,
                                            )}{" "}
                                            -{" "}
                                            {formatTime(
                                                schedule.summary.latestEnd,
                                            )}
                                        </p>
                                        {schedule.summary
                                            .averageInstructorRating != null ? (
                                            <p>
                                                Avg. Rating{" "}
                                                {
                                                    schedule.summary
                                                        .averageInstructorRating
                                                }
                                            </p>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(event) =>
                                            onFavorite(event, schedule)
                                        }
                                        disabled={isSavingFavorite}
                                        aria-pressed={isFavorited}
                                        aria-label={
                                            isFavorited
                                                ? "Unfavorite schedule"
                                                : "Favorite schedule"
                                        }
                                        title={
                                            isFavorited
                                                ? "Unfavorite schedule"
                                                : "Favorite schedule"
                                        }
                                        className={`p-1.5 rounded transition-colors ${
                                            isFavorited
                                                ? "text-yellow-500 hover:text-background/35"
                                                : "text-background/30 hover:text-yellow-500"
                                        } disabled:cursor-default`}
                                    >
                                        <FaStar
                                            className={
                                                isSavingFavorite
                                                    ? "animate-pulse"
                                                    : ""
                                            }
                                        />
                                    </button>
                                </div>

                                {favoriteState?.error ? (
                                    <p className="mt-3 text-xs text-red-600">
                                        {favoriteState.error}
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
