import { FaRegTrashAlt, FaPlus } from "react-icons/fa";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import {
    RequirementCourse,
    useScheduleDraft,
} from "@/contexts/ScheduleDraftContext";

type RequirementSection = RequirementCourse["sections"][number];

type RequirementSectionRow = RequirementSection & {
    rowKey: string;
};

type EditableTextCellProps = {
    value: string;
    onCommit: (value: string) => void;
    className?: string;
};

function EditableTextCell({
    value,
    onCommit,
    className = "",
}: EditableTextCellProps) {
    const [draftValue, setDraftValue] = useState(value);

    function handleBlur() {
        const nextValue = draftValue.trim();
        if (nextValue && nextValue !== value) {
            onCommit(nextValue);
        } else {
            setDraftValue(value);
        }
    }

    return (
        <input
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={handleBlur}
            className={`w-full bg-transparent outline-none border border-transparent rounded px-2 py-1 focus:border-accent hover:border-background/20 ${className}`}
        />
    );
}

type EditableNumberCellProps = {
    value: number;
    onCommit: (value: number) => void;
};

function EditableNumberCell({ value, onCommit }: EditableNumberCellProps) {
    const [draftValue, setDraftValue] = useState(String(value));

    function handleBlur() {
        const nextValue = Number.parseInt(draftValue, 10);
        if (
            Number.isFinite(nextValue) &&
            nextValue > 0 &&
            nextValue !== value
        ) {
            onCommit(nextValue);
        } else {
            setDraftValue(String(value));
        }
    }

    return (
        <input
            type="number"
            min={1}
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={handleBlur}
            className="w-24 bg-transparent outline-none border border-transparent rounded px-2 py-1 focus:border-accent hover:border-background/20"
        />
    );
}

type RequirementSectionsTableProps = {
    sections: RequirementSection[];
    onUpdateSection: (
        rowIndex: number,
        patch: Partial<RequirementSection>,
    ) => void;
    onRemoveSection: (rowIndex: number) => void;
};

function RequirementSectionsTable({
    sections,
    onUpdateSection,
    onRemoveSection,
}: RequirementSectionsTableProps) {
    const data = useMemo<RequirementSectionRow[]>(
        () =>
            sections.map((section, index) => ({
                ...section,
                rowKey: `${section.subjectCode}-${section.courseNumber}-${index}`,
            })),
        [sections],
    );

    const columns = useMemo<ColumnDef<RequirementSectionRow>[]>(
        () => [
            {
                accessorKey: "subjectCode",
                header: "Subject",
                cell: ({ row, getValue }) => (
                    <EditableTextCell
                        value={String(getValue())}
                        onCommit={(value) =>
                            onUpdateSection(row.index, {
                                subjectCode: value.toUpperCase(),
                            })
                        }
                        className="font-semibold uppercase"
                    />
                ),
            },
            {
                accessorKey: "courseNumber",
                header: "Course #",
                cell: ({ row, getValue }) => (
                    <EditableNumberCell
                        value={Number(getValue())}
                        onCommit={(value) =>
                            onUpdateSection(row.index, {
                                courseNumber: value,
                            })
                        }
                    />
                ),
            },
            {
                id: "label",
                header: "Course",
                cell: ({ row }) => (
                    <span className="text-sm text-background/70">
                        {row.original.subjectCode} {row.original.courseNumber}
                    </span>
                ),
            },
            {
                id: "actions",
                header: "",
                cell: ({ row }) => (
                    <div className="text-right">
                        {sections.length > 1 && (
                            <button
                                type="button"
                                onClick={() => onRemoveSection(row.index)}
                                className="text-background/40 hover:text-red-500 transition-colors text-sm px-2 py-1"
                            >
                                <FaRegTrashAlt />
                            </button>
                        )}
                    </div>
                ),
            },
        ],
        [onRemoveSection, onUpdateSection, sections.length],
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.rowKey,
    });

    return (
        <table className="w-full text-left border-collapse mt-4">
            <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <tr
                        key={headerGroup.id}
                        className="border-b border-background/20"
                    >
                        {headerGroup.headers.map((header) => (
                            <th
                                key={header.id}
                                className="text-background/60 text-sm font-semibold pb-2 px-2"
                            >
                                {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                          header.column.columnDef.header,
                                          header.getContext(),
                                      )}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody>
                {table.getRowModel().rows.map((row) => (
                    <tr
                        key={row.id}
                        className="border-b border-background/10 hover:bg-background/5 transition-colors"
                    >
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                className="p-2 align-middle text-background"
                            >
                                {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                )}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function parseCourseInput(rawInput: string) {
    const match = rawInput.trim().match(/^([a-zA-Z]+)\s*(\d+)$/);

    if (!match) {
        return null;
    }

    return {
        subjectCode: match[1].toUpperCase(),
        courseNumber: Number.parseInt(match[2], 10),
    } satisfies RequirementSection;
}

export default function ScheduleRequestStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, updateDraft } = useScheduleDraft();
    const navigate = useNavigate();

    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
        null,
    );

    const selectedCourse = draft.requirementCourses.find(
        (group) => group.id === selectedCourseId,
    );

    function handleGenerate() {
        navigate(`/catalogs/${catalogId}/results/mock-result-123`);
    }

    function handleAddCourse(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const rawInput = String(formData.get("courseInput") || "");
        const parsed = parseCourseInput(rawInput);

        if (!parsed) {
            alert("Please enter a valid course format, like CS 2104.");
            return;
        }

        const label = `${parsed.subjectCode} ${parsed.courseNumber}`;
        const alreadyExists = draft.requirementCourses.some(
            (group) => group.label === label,
        );

        if (alreadyExists) {
            return;
        }

        const id = `req-${parsed.subjectCode.toLowerCase()}-${parsed.courseNumber}-${Date.now()}`;

        const newGroup: RequirementCourse = {
            id,
            label,
            minSections: 1,
            maxSections: 1,
            sections: [],
        };

        updateDraft({
            requirementCourses: [...draft.requirementCourses, newGroup],
        });
        setSelectedCourseId(id);
        e.currentTarget.reset();
    }

    function removeCourse(id: string, e: React.MouseEvent) {
        e.stopPropagation();

        updateDraft({
            requirementCourses: draft.requirementCourses.filter(
                (group) => group.id !== id,
            ),
        });

        if (selectedCourseId === id) {
            setSelectedCourseId(null);
        }
    }

    function handleUpdateCourse(
        groupId: string,
        patch: Partial<RequirementCourse>,
    ) {
        updateDraft({
            requirementCourses: draft.requirementCourses.map((group) =>
                group.id === groupId ? { ...group, ...patch } : group,
            ),
        });
    }

    function handleAddSectionToCourse(
        e: React.FormEvent<HTMLFormElement>,
        groupId: string,
    ) {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const rawInput = String(formData.get("subCourseInput") || "");
        const parsed = parseCourseInput(rawInput);

        if (!parsed) {
            alert("Please enter a valid course format, like CS 2104.");
            return;
        }

        const group = draft.requirementCourses.find(
            (item) => item.id === groupId,
        );
        if (!group) return;

        const alreadyInGroup = group.sections.some(
            (section) =>
                section.subjectCode === parsed.subjectCode &&
                section.courseNumber === parsed.courseNumber,
        );

        if (alreadyInGroup) {
            alert("Course already in this pool.");
            return;
        }

        handleUpdateCourse(groupId, {
            sections: [...group.sections, parsed],
        });

        e.currentTarget.reset();
    }

    function handleUpdateSectionAtIndex(
        groupId: string,
        rowIndex: number,
        patch: Partial<RequirementSection>,
    ) {
        const group = draft.requirementCourses.find(
            (item) => item.id === groupId,
        );
        if (!group) return;

        const nextSections = group.sections.map((section, index) =>
            index === rowIndex ? { ...section, ...patch } : section,
        );

        handleUpdateCourse(groupId, {
            sections: nextSections,
        });
    }

    function handleRemoveSectionAtIndex(groupId: string, rowIndex: number) {
        const group = draft.requirementCourses.find(
            (item) => item.id === groupId,
        );
        if (!group || group.sections.length <= 1) return;

        const nextSections = group.sections.filter(
            (_, index) => index !== rowIndex,
        );
        const nextChooseCount = Math.min(
            group.minSections,
            nextSections.length,
        );

        handleUpdateCourse(groupId, {
            sections: nextSections,
            minSections: nextChooseCount,
            maxSections: nextChooseCount,
        });
    }

    return (
        <>
            <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide">
                    Requirements
                </h2>

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
                        <FaPlus />
                    </button>
                </form>

                <div className="flex flex-col gap-2 overflow-y-auto mt-2">
                    {draft.requirementCourses.length === 0 ? (
                        <p className="text-sm text-background/40 italic">
                            No requirements added yet.
                        </p>
                    ) : (
                        draft.requirementCourses.map((group) => {
                            const isSelected = group.id === selectedCourseId;

                            return (
                                <div
                                    key={group.id}
                                    onClick={() =>
                                        setSelectedCourseId(group.id)
                                    }
                                    className={`p-3 border rounded-md flex justify-between items-center cursor-pointer transition-colors ${
                                        isSelected
                                            ? "border-accent bg-accent/5"
                                            : "border-background/20 bg-background/5 hover:border-background/40"
                                    }`}
                                >
                                    <div>
                                        <h3
                                            className={`font-semibold ${
                                                isSelected
                                                    ? "text-accent"
                                                    : "text-background"
                                            }`}
                                        >
                                            {group.label}
                                        </h3>
                                        <p className="text-xs text-background/60 mt-1">
                                            Choose {group.minSections} from{" "}
                                            {group.sections.length}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) =>
                                            removeCourse(group.id, e)
                                        }
                                        className="text-red-500 hover:text-red-700 font-semibold text-sm px-2 py-1"
                                    >
                                        <FaRegTrashAlt />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>

            <main className="bg-surface rounded-[10px] p-6 flex flex-col">
                {!selectedCourse ? (
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
                                    value={selectedCourse.label}
                                    onChange={(e) =>
                                        handleUpdateCourse(selectedCourse.id, {
                                            label: e.target.value,
                                        })
                                    }
                                    className="text-xl font-semibold text-background bg-transparent border-b border-transparent hover:border-background/20 focus:border-accent outline-none px-1 py-1 -ml-1 transition-colors"
                                />
                                <p className="text-background/60 text-sm mt-1">
                                    Configure which courses can satisfy this
                                    requirement.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <form
                                onSubmit={(e) =>
                                    handleAddSectionToCourse(
                                        e,
                                        selectedCourse.id,
                                    )
                                }
                                className="flex gap-2 mb-2"
                            >
                                <input
                                    type="text"
                                    name="subCourseInput"
                                    placeholder="Add section, like CS 2104"
                                    maxLength={15}
                                    required
                                    className="flex-1 px-3 py-2 border border-background/20 rounded-md bg-transparent focus:border-accent outline-none transition-colors uppercase text-sm"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-text/10 text-background rounded-md text-sm font-medium hover:bg-text/20 transition-colors"
                                >
                                    Add Section
                                </button>
                            </form>

                            <RequirementSectionsTable
                                sections={selectedCourse.sections}
                                onUpdateSection={(rowIndex, patch) =>
                                    handleUpdateSectionAtIndex(
                                        selectedCourse.id,
                                        rowIndex,
                                        patch,
                                    )
                                }
                                onRemoveSection={(rowIndex) =>
                                    handleRemoveSectionAtIndex(
                                        selectedCourse.id,
                                        rowIndex,
                                    )
                                }
                            />
                        </div>
                    </div>
                )}

                <div className="mt-auto flex justify-end pt-4 border-t border-background/10">
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={draft.requirementCourses.length === 0}
                        className="px-6 py-2 bg-accent text-white rounded-md font-bold disabled:opacity-50 hover:bg-accent/90 transition-colors"
                    >
                        Generate Schedules
                    </button>
                </div>
            </main>

            <aside className="bg-surface rounded-[10px] p-4">
                <div>
                    <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                        Selected Section
                    </h2>
                </div>

                <div>
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
        </>
    );
}
