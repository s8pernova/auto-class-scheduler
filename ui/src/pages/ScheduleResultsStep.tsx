import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useScheduleDraft } from "@/contexts/ScheduleDraftContext";

export default function ScheduleResultsStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft } = useScheduleDraft();
    const navigate = useNavigate();

    if (draft.requirementCourses.length === 0) {
        return <Navigate to={`/catalogs/${catalogId}/build`} replace />;
    }

    if (!draft.generationResult) {
        return <Navigate to={`/catalogs/${catalogId}/instructors`} replace />;
    }

    const { generationResult } = draft;

    function handleBack() {
        navigate(`/catalogs/${catalogId}/instructors`);
    }

    return (
        <div className="grid grid-cols-[288px_1fr_280px] gap-[15px] h-full">
            <aside className="bg-surface rounded-[10px] p-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Filters
                </h2>
                <div className="text-sm text-background/70 space-y-2">
                    <p>Catalog: {draft.catalogId}</p>
                    <p>{generationResult.validCount} valid schedules</p>
                    <p>{generationResult.returnedCount} shown</p>
                </div>
            </aside>

            <main className="bg-surface rounded-[10px] p-[10px] overflow-y-auto">
                {generationResult.schedules.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-background/50 text-sm">
                        No valid schedules matched these constraints.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-[10px]">
                        {generationResult.schedules.map((schedule) => (
                            <div
                                key={schedule.resultId}
                                className="border border-background/10 rounded-[10px] p-4 bg-background/5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold text-background">
                                            Schedule {schedule.resultId}
                                        </h3>
                                        <p className="text-xs text-background/60 mt-1">
                                            {schedule.totalCredits} credits,{" "}
                                            {schedule.campusPattern}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm text-background/70">
                                        <p>
                                            {schedule.earliestStart} -{" "}
                                            {schedule.latestEnd}
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
                                            key={`${schedule.resultId}-${section.subjectCode}-${section.courseNumber}-${section.sectionCode}`}
                                            className="rounded-md border border-background/10 px-3 py-2 text-sm"
                                        >
                                            <div className="font-semibold text-background">
                                                {section.subjectCode}{" "}
                                                {section.courseNumber}-{" "}
                                                {section.sectionCode}
                                            </div>
                                            <div className="text-background/60">
                                                {section.instructorName ||
                                                    "Instructor TBD"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
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
        </div>
    );
}
