import { FaRegTrashAlt, FaPlus } from "react-icons/fa";
import { useMemo, useState } from "react";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import type { SectionRef } from "@/contexts/ScheduleDraftContext";
import { EditableTextCell } from "./EditableTextCell";

type RequirementSectionRow = SectionRef & {
    rowKey: string;
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

export type RequirementSectionsTableProps = {
    sections: SectionRef[];
    onUpdateSection: (rowIndex: number, patch: Partial<SectionRef>) => void;
    onRemoveSection: (rowIndex: number) => void;
    onAddSection: (sectionData: Partial<SectionRef>) => void;
};

export function RequirementSectionsTable({
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
                            } as Partial<SectionRef>)
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
