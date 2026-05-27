import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { generateSchedules } from "@/api/client";
import { useScheduleDraft } from "@/contexts/ScheduleDraftContext";
import { buildScheduleGenerateRequest } from "@/utils/buildScheduleGenerateRequest";

function ratingInputValue(value: number | null | undefined): string {
    return value === null || value === undefined ? "" : String(value);
}

function parseRatingInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const rating = Number(trimmed);
    if (!Number.isFinite(rating)) return null;

    return Math.min(5, Math.max(0, rating));
}

export default function InstructorRatings() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, updateDraft } = useScheduleDraft();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const instructorNames = useMemo(() => {
        const names = new Set<string>();

        for (const course of draft.requirementCourses) {
            for (const section of course.sections) {
                const instructor = section.instructor?.trim();
                if (instructor) {
                    names.add(instructor);
                }
            }
        }

        return [...names].sort((a, b) => a.localeCompare(b));
    }, [draft.requirementCourses]);

    if (draft.requirementCourses.length === 0) {
        return <Navigate to={`/catalogs/${catalogId}/build`} replace />;
    }

    function handleBack() {
        navigate(`/catalogs/${catalogId}/build`);
    }

    function handleRatingChange(instructorName: string, value: string) {
        updateDraft({
            instructorRatings: {
                ...draft.instructorRatings,
                [instructorName]: parseRatingInput(value),
            },
        });
    }

    async function handleSubmit() {
        setError(null);
        setIsSubmitting(true);

        try {
            const payload = buildScheduleGenerateRequest(draft);
            const generationResult = await generateSchedules(payload);

            updateDraft({ generationResult });
            navigate(`/catalogs/${catalogId}/results`);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to generate schedules.",
            );
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide">
                    Instructors
                </h2>
                <div className="flex flex-col gap-2 overflow-y-auto">
                    {instructorNames.length === 0 ? (
                        <p className="text-sm text-background/40 italic">
                            No instructors named yet.
                        </p>
                    ) : (
                        instructorNames.map((name) => (
                            <div
                                key={name}
                                className="p-3 border border-background/20 rounded-md bg-background/5"
                            >
                                <p className="font-semibold text-background">
                                    {name}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            <main className="bg-surface rounded-[10px] p-6 flex flex-col min-h-0">
                <div>
                    <h1 className="text-xl font-semibold mb-2 text-background/80">
                        Instructor Ratings
                    </h1>
                    <p className="text-background/60 text-sm">
                        Add optional ratings before generating schedules.
                    </p>
                </div>

                <div className="mt-6 overflow-y-auto">
                    {instructorNames.length === 0 ? (
                        <div className="border border-background/10 rounded-md p-4 text-sm text-background/60">
                            Continue to generate schedules without instructor
                            scores.
                        </div>
                    ) : (
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead>
                                <tr>
                                    <th className="px-2 pt-2 pb-2 text-left text-sm font-semibold text-background/60 border-b border-background/20">
                                        Instructor
                                    </th>
                                    <th className="px-2 pt-2 pb-2 text-left text-sm font-semibold text-background/60 border-b border-background/20 w-40">
                                        Rating
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {instructorNames.map((name) => (
                                    <tr
                                        key={name}
                                        className="hover:bg-background/5 transition-colors"
                                    >
                                        <td className="p-2 align-middle text-background border-b border-background/10">
                                            {name}
                                        </td>
                                        <td className="p-2 align-middle border-b border-background/10">
                                            <input
                                                type="number"
                                                min="0"
                                                max="5"
                                                step="0.1"
                                                value={ratingInputValue(
                                                    draft.instructorRatings[
                                                        name
                                                    ],
                                                )}
                                                onChange={(e) =>
                                                    handleRatingChange(
                                                        name,
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-full bg-transparent outline-none border border-background/20 rounded px-2 py-1 focus:border-accent hover:border-background/40 text-sm"
                                                placeholder="0-5"
                                                aria-label={`${name} rating`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {error ? (
                    <div className="mt-4 border border-red-500/40 bg-red-500/10 text-red-700 rounded-md px-3 py-2 text-sm">
                        {error}
                    </div>
                ) : null}

                <div className="mt-auto flex justify-between pt-4 border-t border-background/10">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="px-4 py-2 border border-background/20 text-background rounded-md font-semibold hover:bg-background/5 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-accent text-white rounded-md font-bold disabled:opacity-50 hover:bg-accent/90 transition-colors"
                    >
                        {isSubmitting ? "Generating..." : "Generate Schedules"}
                    </button>
                </div>
            </main>

            <aside className="bg-surface rounded-[10px] p-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Summary
                </h2>
                <div className="text-sm text-background/70 space-y-2">
                    <p>{draft.requirementCourses.length} requirements</p>
                    <p>
                        {draft.requirementCourses.reduce(
                            (total, course) => total + course.sections.length,
                            0,
                        )}{" "}
                        candidate sections
                    </p>
                    <p>{instructorNames.length} instructors</p>
                </div>
            </aside>
        </>
    );
}
