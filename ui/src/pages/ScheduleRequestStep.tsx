import { FaRegTrashAlt, FaPlus } from "react-icons/fa";
import { useEffect, useMemo, useState } from "react";
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

    useEffect(() => {
        setDraftValue(value);
    }, [value]);

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

type RequirementSectionsTableProps = {
    sections: RequirementSection[];
    onUpdateSection: (
        rowIndex: number,
        patch: Partial<RequirementSection>,
    ) => void;
    onRemoveSection: (rowIndex: number) => void;
    onAddSection: (sectionData: Partial<RequirementSection>) => void;
};

type SectionFieldKey = "days" | "time" | "crn" | "instructor";

type SectionDraft = Record<SectionFieldKey, string>;

const SECTION_FIELDS = [
    {
        key: "days",
        header: "Days",
        placeholder: "MWF",
    },
    {
        key: "time",
        header: "Time",
        placeholder: "10:00AM-11:00AM",
    },
    {
        key: "crn",
        header: "CRN",
        placeholder: "12345",
    },
    {
        key: "instructor",
        header: "Instructor",
        placeholder: "Smith",
    },
] as const satisfies readonly {
    key: SectionFieldKey;
    header: string;
    placeholder: string;
}[];

function createEmptySectionDraft(): SectionDraft {
    return {
        days: "",
        time: "",
        crn: "",
        instructor: "",
    };
}

function RequirementSectionsTable({
    sections,
    onUpdateSection,
    onRemoveSection,
    onAddSection,
}: RequirementSectionsTableProps) {
    const [newSection, setNewSection] = useState<SectionDraft>(
        createEmptySectionDraft,
    );

    const data = useMemo<RequirementSectionRow[]>(
        () =>
            sections.map((section, index) => ({
                ...section,
                rowKey: `${section.subjectCode}-${section.courseNumber}-${index}`,
            })),
        [sections],
    );

    const columns = useMemo<ColumnDef<RequirementSectionRow>[]>(() => {
        function makeTextColumn(
            key: SectionFieldKey,
            header: string,
        ): ColumnDef<RequirementSectionRow> {
            return {
                id: key,
                accessorFn: (row) => row[key] ?? "",
                header,
                cell: ({ row, getValue }) => (
                    <EditableTextCell
                        value={String(getValue() || "")}
                        onCommit={(value) =>
                            onUpdateSection(row.index, {
                                [key]: value,
                            } as Partial<RequirementSection>)
                        }
                    />
                ),
            };
        }

        return [
            {
                id: "required",
                header: "Required",
                columns: [
                    makeTextColumn("days", "Days"),
                    makeTextColumn("time", "Time"),
                ],
            },
            {
                id: "optional",
                header: "Optional",
                columns: [
                    makeTextColumn("crn", "CRN"),
                    makeTextColumn("instructor", "Instructor"),
                ],
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
                                aria-label="Remove section"
                            >
                                <FaRegTrashAlt />
                            </button>
                        )}
                    </div>
                ),
            },
        ];
    }, [onRemoveSection, onUpdateSection, sections.length]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.rowKey,
    });

    const canAddSection =
        newSection.days.trim().length > 0 && newSection.time.trim().length > 0;

    function handleAddSection() {
        if (!canAddSection) return;

        onAddSection({
            days: newSection.days.trim(),
            time: newSection.time.trim(),
            crn: newSection.crn.trim(),
            instructor: newSection.instructor.trim(),
        });

        setNewSection(createEmptySectionDraft());
    }

    function handleAddRowKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== "Enter") return;

        e.preventDefault();
        handleAddSection();
    }

    return (
        <table className="w-full text-left border-separate border-spacing-0 mt-4">
            <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                            const isGroupHeader = header.subHeaders.length > 0;

                            return (
                                <th
                                    key={header.id}
                                    colSpan={header.colSpan}
                                    className={
                                        isGroupHeader
                                            ? "px-2 pt-3 pb-1 text-center"
                                            : "px-2 pt-2 pb-2 text-left text-sm font-semibold text-background/60 border-b border-background/20"
                                    }
                                >
                                    {header.isPlaceholder ? null : isGroupHeader ? (
                                        <div className="relative h-3 border-t border-x border-background/35 rounded-t-md">
                                            <span className="absolute left-1/2 -top-2 -translate-x-1/2 bg-surface px-2 text-[10px] font-bold uppercase tracking-wide text-background/55">
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                            </span>
                                        </div>
                                    ) : (
                                        flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )
                                    )}
                                </th>
                            );
                        })}
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
                                className="p-2 align-middle text-background border-b border-background/10"
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

            <tfoot>
                <tr className="hover:bg-background/5 transition-colors">
                    {table.getAllLeafColumns().map((column) => {
                        if (column.id === "actions") {
                            return (
                                <td
                                    key={column.id}
                                    className="p-2 align-middle text-right"
                                >
                                    <button
                                        type="button"
                                        onClick={handleAddSection}
                                        disabled={!canAddSection}
                                        className="text-accent hover:text-accent/80 disabled:text-background/25 disabled:cursor-not-allowed transition-colors text-sm px-2 py-1"
                                        aria-label="Add section"
                                    >
                                        <FaPlus />
                                    </button>
                                </td>
                            );
                        }

                        const field = SECTION_FIELDS.find(
                            (item) => item.key === column.id,
                        );

                        if (!field) {
                            return <td key={column.id} className="p-2" />;
                        }

                        return (
                            <td
                                key={column.id}
                                className="p-2 align-middle text-background"
                            >
                                <input
                                    type="text"
                                    value={newSection[field.key]}
                                    onChange={(e) =>
                                        setNewSection((current) => ({
                                            ...current,
                                            [field.key]: e.target.value,
                                        }))
                                    }
                                    onKeyDown={handleAddRowKeyDown}
                                    className="w-full bg-transparent outline-none border border-transparent rounded px-2 py-1 focus:border-accent hover:border-background/20 text-sm"
                                    placeholder={field.placeholder}
                                    aria-label={`New section ${field.header}`}
                                />
                            </td>
                        );
                    })}
                </tr>
            </tfoot>
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
        days: "",
        time: "",
    } satisfies RequirementSection;
}

export default function ScheduleRequestStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, updateDraft } = useScheduleDraft();
    const navigate = useNavigate();

    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
        null,
    );
    const [highlightedCourseId, setHighlightedCourseId] = useState<
        string | null
    >(null);

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
        const existingGroup = draft.requirementCourses.find(
            (group) => group.label === label,
        );

        if (existingGroup) {
            setHighlightedCourseId(existingGroup.id);
            setTimeout(() => {
                setHighlightedCourseId((prev) =>
                    prev === existingGroup.id ? null : prev,
                );
            }, 1000);
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
        sectionData: Partial<RequirementSection>,
        groupId: string,
    ) {
        const group = draft.requirementCourses.find(
            (item) => item.id === groupId,
        );
        if (!group) return;

        const parsedGroupCourse = parseCourseInput(group.label);
        if (!parsedGroupCourse) {
            alert("Group label is not a valid course format.");
            return;
        }

        const newSection: RequirementSection = {
            subjectCode: parsedGroupCourse.subjectCode,
            courseNumber: parsedGroupCourse.courseNumber,
            days: sectionData.days || "",
            time: sectionData.time || "",
            crn: sectionData.crn || "",
            instructor: sectionData.instructor || "",
        };

        handleUpdateCourse(groupId, {
            sections: [...group.sections, newSection],
        });
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
                            const isHighlighted =
                                group.id === highlightedCourseId;

                            return (
                                <div
                                    key={group.id}
                                    onClick={() =>
                                        setSelectedCourseId(group.id)
                                    }
                                    className={`p-3 border rounded-md flex justify-between items-center cursor-pointer transition-colors duration-500 ${
                                        isHighlighted
                                            ? "border-red-500 bg-red-500/10"
                                            : isSelected
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
                    <div className="flex flex-col gap-2">
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
                                onAddSection={(sectionData) =>
                                    handleAddSectionToCourse(
                                        sectionData,
                                        selectedCourse.id,
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
