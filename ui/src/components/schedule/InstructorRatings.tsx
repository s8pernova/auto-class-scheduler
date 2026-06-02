import { FaBan, FaRegStar, FaStar, FaTimes, FaUndo } from "react-icons/fa";
import type { InstructorRatings as InstructorRatingsMap } from "@/contexts/ScheduleDraftContext";

const SCORE_VALUES = [1, 2, 3, 4, 5] as const;

type InstructorRatingsProps = {
    instructorNames: string[];
    ignoredInstructorNames: string[];
    ratings: InstructorRatingsMap;
    onSetRating: (instructorName: string, rating: number | null) => void;
    onIgnoreInstructor: (instructorName: string) => void;
    onRestoreInstructor: (instructorName: string) => void;
};

function ratingValue(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(value) || value <= 0) return null;

    return Math.min(5, Math.max(1, Math.round(value)));
}

export default function InstructorRatings({
    instructorNames,
    ignoredInstructorNames,
    ratings,
    onSetRating,
    onIgnoreInstructor,
    onRestoreInstructor,
}: InstructorRatingsProps) {
    const visibleInstructorNames = instructorNames.filter(
        (name) => !ignoredInstructorNames.includes(name),
    );
    const visibleIgnoredInstructorNames = ignoredInstructorNames.filter((name) =>
        instructorNames.includes(name),
    );
    const hasInstructors = instructorNames.length > 0;

    return (
        <aside className="bg-surface rounded-[10px] p-4 flex min-h-0 flex-col gap-4">
            <div>
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide">
                    Instructor preferences
                </h2>
                <p className="mt-1 text-xs font-semibold text-background/40 uppercase tracking-wide">
                    Your score
                </p>
            </div>

            {!hasInstructors ? (
                <p className="rounded-md border border-background/10 px-3 py-3 text-sm text-background/45">
                    No instructors yet
                </p>
            ) : (
                <div className="min-h-0 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-2">
                        {visibleInstructorNames.map((name) => {
                            const currentRating = ratingValue(ratings[name]);

                            return (
                                <div
                                    key={name}
                                    className="rounded-md border border-background/10 bg-background/5 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="min-w-0 break-words text-sm font-semibold text-background">
                                            {name}
                                        </p>
                                        <span className="shrink-0 text-xs font-semibold text-background/45">
                                            {currentRating
                                                ? `${currentRating}/5`
                                                : "No score"}
                                        </span>
                                    </div>

                                    <div className="mt-3 flex items-center gap-1">
                                        <div
                                            className="flex items-center gap-0.5"
                                            aria-label={`${name} preference score`}
                                        >
                                            {SCORE_VALUES.map((score) => {
                                                const isSelected =
                                                    currentRating !== null &&
                                                    score <= currentRating;

                                                return (
                                                    <button
                                                        key={score}
                                                        type="button"
                                                        onClick={() =>
                                                            onSetRating(
                                                                name,
                                                                score,
                                                            )
                                                        }
                                                        className={`rounded p-1 text-sm transition-colors ${
                                                            isSelected
                                                                ? "text-accent hover:text-accent/80"
                                                                : "text-background/25 hover:text-background/50"
                                                        }`}
                                                        title={`Set score ${score}`}
                                                        aria-label={`Set ${name} score to ${score}`}
                                                    >
                                                        {isSelected ? (
                                                            <FaStar />
                                                        ) : (
                                                            <FaRegStar />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="ml-auto flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onSetRating(name, null)
                                                }
                                                disabled={currentRating === null}
                                                className="rounded p-1 text-sm text-background/30 transition-colors hover:text-background/60 disabled:cursor-not-allowed disabled:text-background/15"
                                                title="Clear score"
                                                aria-label={`Clear ${name} score`}
                                            >
                                                <FaTimes />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onIgnoreInstructor(name)
                                                }
                                                className="rounded p-1 text-sm text-background/30 transition-colors hover:text-background/60"
                                                title="Ignore instructor"
                                                aria-label={`Ignore ${name}`}
                                            >
                                                <FaBan />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {visibleIgnoredInstructorNames.map((name) => (
                            <div
                                key={name}
                                className="rounded-md border border-background/10 bg-background/5 p-3 opacity-75"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-semibold text-background">
                                            {name}
                                        </p>
                                        <p className="text-xs font-semibold text-background/45">
                                            Ignored
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRestoreInstructor(name)
                                        }
                                        className="shrink-0 rounded p-1 text-sm text-background/35 transition-colors hover:text-background/65"
                                        title="Restore instructor"
                                        aria-label={`Restore ${name}`}
                                    >
                                        <FaUndo />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}
