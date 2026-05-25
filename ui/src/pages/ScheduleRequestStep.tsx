import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    useScheduleDraft,
    RequirementGroup,
} from "@/contexts/ScheduleDraftContext";

export default function ScheduleRequestStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, updateDraft } = useScheduleDraft();
    const navigate = useNavigate();

    // Master-detail state
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const selectedGroup = draft.requirementGroups.find(
        (g) => g.id === selectedGroupId,
    );

    function handleGenerate() {
        // TODO: call API to generate schedule and get resultSetId
        // For now, navigate to mock resultSetId
        navigate(`/catalogs/${catalogId}/results/mock-result-123`);
    }

    function handleAddGroup(e: React.FormEvent<HTMLFormElement>) {
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

        // Idempotency
        if (draft.requirementGroups.find((g) => g.label === label)) {
            // TODO highlight the existing group in red outline
            return;
        }

        const id = `req-${subjectCode.toLowerCase()}-${courseNumber}-${Date.now()}`;

        const newGroup: RequirementGroup = {
            id,
            label,
            minCourses: 1,
            maxCourses: 1,
            courses: [{ subjectCode, courseNumber }],
        };

        updateDraft({
            requirementGroups: [...draft.requirementGroups, newGroup],
        });
        setSelectedGroupId(id); // Select it immediately
        e.currentTarget.reset();
    }

    function removeGroup(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        updateDraft({
            requirementGroups: draft.requirementGroups.filter(
                (g) => g.id !== id,
            ),
        });
        if (selectedGroupId === id) {
            setSelectedGroupId(null);
        }
    }

    function handleUpdateGroup(
        groupId: string,
        patch: Partial<RequirementGroup>,
    ) {
        updateDraft({
            requirementGroups: draft.requirementGroups.map((g) =>
                g.id === groupId ? { ...g, ...patch } : g,
            ),
        });
    }

    function handleAddCourseToGroup(
        e: React.FormEvent<HTMLFormElement>,
        groupId: string,
    ) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const rawInput = String(formData.get("subCourseInput") || "").trim();

        if (!rawInput) return;

        const match = rawInput.match(/^([a-zA-Z]+)\s*(\d+)$/);
        if (!match) {
            alert("Please enter a valid course format (e.g., CS 2104)");
            return;
        }

        const subjectCode = match[1].toUpperCase();
        const courseNumber = parseInt(match[2], 10);

        const group = draft.requirementGroups.find((g) => g.id === groupId);
        if (!group) return;

        // Check for duplicates
        if (
            group.courses.find(
                (c) =>
                    c.subjectCode === subjectCode &&
                    c.courseNumber === courseNumber,
            )
        ) {
            alert("Course already in this group");
            return;
        }

        handleUpdateGroup(groupId, {
            courses: [...group.courses, { subjectCode, courseNumber }],
        });

        e.currentTarget.reset();
    }

    function handleRemoveCourseFromGroup(
        groupId: string,
        subjectCode: string,
        courseNumber: number,
    ) {
        const group = draft.requirementGroups.find((g) => g.id === groupId);
        if (!group) return;

        handleUpdateGroup(groupId, {
            courses: group.courses.filter(
                (c) =>
                    !(
                        c.subjectCode === subjectCode &&
                        c.courseNumber === courseNumber
                    ),
            ),
        });
    }

    return (
        <div className="grid grid-cols-[380px_1fr_300px] gap-[15px] h-full">
            <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide">
                    Requirements
                </h2>
                <form onSubmit={handleAddGroup} className="flex gap-2">
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

                <div className="flex flex-col gap-2 overflow-y-auto mt-2">
                    {draft.requirementGroups.length === 0 ? (
                        <p className="text-sm text-background/40 italic">
                            No requirements added yet.
                        </p>
                    ) : (
                        draft.requirementGroups.map((group) => {
                            const isSelected = group.id === selectedGroupId;
                            return (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`p-3 border rounded-md flex justify-between items-center cursor-pointer transition-colors ${
                                        isSelected
                                            ? "border-accent bg-accent/5"
                                            : "border-background/20 bg-background/5 hover:border-background/40"
                                    }`}
                                >
                                    <div>
                                        <h3
                                            className={`font-semibold ${isSelected ? "text-accent" : "text-background"}`}
                                        >
                                            {group.label}
                                        </h3>
                                        <p className="text-xs text-background/60 mt-1">
                                            {group.courses.length} course
                                            {group.courses.length !== 1
                                                ? "s"
                                                : ""}{" "}
                                            pool
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) =>
                                            removeGroup(group.id, e)
                                        }
                                        className="text-red-500 hover:text-red-700 font-semibold text-sm px-2 py-1"
                                    >
                                        Remove
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>

            <main className="bg-surface rounded-[10px] p-6 flex flex-col">
                {!selectedGroup ? (
                    <div className="flex-1 flex flex-col text-background/40">
                        <h1 className="text-xl font-semibold mb-2 text-background/60">
                            Build Your Schedule
                        </h1>
                        <p>
                            Add a requirement on the left, or select an existing
                            one to edit its allowed courses.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <input
                                    type="text"
                                    value={selectedGroup.label}
                                    onChange={(e) =>
                                        handleUpdateGroup(selectedGroup.id, {
                                            label: e.target.value,
                                        })
                                    }
                                    className="text-xl font-semibold text-background bg-transparent border-b border-transparent hover:border-background/20 focus:border-accent outline-none px-1 py-1 -ml-1 transition-colors"
                                />
                                <p className="text-background/60 text-sm mt-1 px-1">
                                    Configure which specific courses fulfill
                                    this requirement.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-background/80 bg-background/5 px-3 py-2 rounded-md">
                                <span>Choose</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={selectedGroup.courses.length || 1}
                                    value={selectedGroup.minCourses}
                                    onChange={(e) =>
                                        handleUpdateGroup(selectedGroup.id, {
                                            minCourses:
                                                parseInt(e.target.value) || 1,
                                            maxCourses:
                                                parseInt(e.target.value) || 1,
                                        })
                                    }
                                    className="w-12 px-2 py-1 bg-transparent border border-background/20 rounded focus:border-accent outline-none text-center"
                                />
                                <span>from pool</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <form
                                onSubmit={(e) =>
                                    handleAddCourseToGroup(e, selectedGroup.id)
                                }
                                className="flex gap-2 mb-2"
                            >
                                <input
                                    type="text"
                                    name="subCourseInput"
                                    placeholder="Add alternative course (e.g. PHIL 1304)"
                                    maxLength={15}
                                    required
                                    className="flex-1 px-3 py-2 border border-background/20 rounded-md bg-transparent focus:border-accent outline-none transition-colors uppercase text-sm"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-text/10 text-background rounded-md text-sm font-medium hover:bg-text/20 transition-colors"
                                >
                                    Add Alternative
                                </button>
                            </form>

                            <div className="grid grid-cols-2 gap-3">
                                {selectedGroup.courses.map((course) => (
                                    <div
                                        key={`${course.subjectCode}-${course.courseNumber}`}
                                        className="p-3 border border-background/20 rounded-md flex justify-between items-center bg-background/5"
                                    >
                                        <span className="font-semibold text-background">
                                            {course.subjectCode}{" "}
                                            {course.courseNumber}
                                        </span>
                                        {selectedGroup.courses.length > 1 && (
                                            <button
                                                onClick={() =>
                                                    handleRemoveCourseFromGroup(
                                                        selectedGroup.id,
                                                        course.subjectCode,
                                                        course.courseNumber,
                                                    )
                                                }
                                                className="text-background/40 hover:text-red-500 transition-colors text-sm"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

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
                <div className="">
                    <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                        Selected Section
                    </h2>
                </div>
                <div className="">
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
                </div>
            </aside>
        </div>
    );
}
