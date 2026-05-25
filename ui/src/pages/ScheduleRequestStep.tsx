import { useNavigate, useParams } from "react-router-dom";
import {
    useScheduleDraft,
    RequirementGroup,
} from "@/contexts/ScheduleDraftContext";

export default function ScheduleRequestStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, updateDraft } = useScheduleDraft();
    const navigate = useNavigate();

    function handleGenerate() {
        // TODO: call API to generate schedule and get resultSetId
        // For now, navigate to mock resultSetId
        navigate(`/catalogs/${catalogId}/results/mock-result-123`);
    }

    function addGroup(group: RequirementGroup) {
        if (!draft.requirementGroups.find((g) => g.id === group.id)) {
            updateDraft({
                requirementGroups: [...draft.requirementGroups, group],
            });
        }
    }

    function removeGroup(id: string) {
        updateDraft({
            requirementGroups: draft.requirementGroups.filter(
                (g) => g.id !== id,
            ),
        });
    }

    function handleAddCourse(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const rawInput = String(formData.get("courseInput") || "").trim();

        if (!rawInput) return;

        // Parse something like "CS 2104" or "cs2104"
        const match = rawInput.match(/^([a-zA-Z]+)\s*(\d+)$/);
        if (!match) {
            alert("Please enter a valid course format (e.g., CS 2104)");
            return;
        }

        const subjectCode = match[1].toUpperCase();
        const courseNumber = parseInt(match[2], 10);
        const label = `${subjectCode} ${courseNumber}`;
        const id = `req-${subjectCode.toLowerCase()}-${courseNumber}-${Date.now()}`;

        const newGroup: RequirementGroup = {
            id,
            label,
            minCourses: 1,
            maxCourses: 1,
            courses: [{ subjectCode, courseNumber }],
        };

        addGroup(newGroup);
        e.currentTarget.reset();
    }

    return (
        <div className="grid grid-cols-[380px_1fr_480px] gap-[15px] h-full">
            <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-8">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Add Requirements
                </h2>
                <div className="flex flex-col gap-2">
                    <form onSubmit={handleAddCourse} className="flex gap-2">
                        <input
                            type="text"
                            name="courseInput"
                            placeholder="e.g. CS 2104"
                            maxLength={15}
                            required
                            className="flex-1 px-3 py-2 border border-background/20 rounded-md bg-transparent focus:border-accent outline-none transition-colors uppercase"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-accent text-white rounded-md font-medium hover:bg-accent/90 transition-colors"
                        >
                            Add
                        </button>
                    </form>
                </div>
                {/* Mapping of courses */}
                {draft.requirementGroups && (
                    <div className="space-y-3">
                        {draft.requirementGroups.map((group) => (
                            <div
                                key={group.id}
                                className="p-3 border border-background/20 rounded-md flex justify-between items-center bg-background/5"
                            >
                                <div>
                                    <h3 className="font-semibold text-background">
                                        {group.label}
                                    </h3>
                                    <p className="text-xs text-background/60 mt-1">
                                        Choose {group.minCourses}-
                                        {group.maxCourses} from:{" "}
                                        {group.courses
                                            .map(
                                                (c) =>
                                                    `${c.subjectCode} ${c.courseNumber}`,
                                            )
                                            .join(", ")}
                                    </p>
                                </div>
                                <button
                                    onClick={() => removeGroup(group.id)}
                                    className="text-red-500 hover:text-red-700 font-semibold text-sm px-2 py-1"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </aside>
            <main className="bg-surface rounded-[10px] p-6 flex flex-col gap-4">
                <h1 className="text-xl font-semibold text-background">
                    Build Your Schedule
                </h1>

                {/* Mapping of specific classes within course */}
                <p className="text-background/60">
                    Choose your required courses, elective pools, and
                    preferences. Then generate possible schedules.
                </p>

                <div className="flex flex-col gap-3 mt-4"></div>

                <div className="mt-auto flex justify-end pt-4 border-t border-background/10">
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={draft.requirementGroups.length === 0}
                        className="px-6 py-2 bg-accent text-white rounded-md font-bold disabled:opacity-50 hover:bg-accent/90 transition-colors"
                    >
                        Generate Schedules →
                    </button>
                </div>
            </main>
            <aside className="bg-surface rounded-[10px] p-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Preferences
                </h2>
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={
                                draft.preferences.allowFullSections || false
                            }
                            onChange={(e) =>
                                updateDraft({
                                    preferences: {
                                        ...draft.preferences,
                                        allowFullSections: e.target.checked,
                                    },
                                })
                            }
                        />
                        <span className="text-sm">Allow full sections</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={
                                draft.preferences.allowRestrictedSections ||
                                false
                            }
                            onChange={(e) =>
                                updateDraft({
                                    preferences: {
                                        ...draft.preferences,
                                        allowRestrictedSections:
                                            e.target.checked,
                                    },
                                })
                            }
                        />
                        <span className="text-sm">
                            Allow restricted sections
                        </span>
                    </label>
                </div>
            </aside>
        </div>
    );
}
