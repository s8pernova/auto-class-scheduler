import { FaRegTrashAlt, FaRegCopy, FaPlus } from "react-icons/fa";
import { type CSSProperties, useMemo, useState } from "react";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import type { SectionRef } from "@/contexts/ScheduleDraftContext";
import { EditableTextCell } from "./EditableTextCell";
import { Combobox } from "@/components/common/Combobox";
import { TimeRangeInput } from "./TimeRangeInput";
import { DaysInput } from "./DaysInput";

type RequirementSectionRow = SectionRef & {
    rowKey: string;
};

type SectionFieldKey = "days" | "time" | "crn" | "instructor";

type SectionDraft = Record<SectionFieldKey, string>;

// Discriminated union for field definitions.
// Add new variants here (e.g. "select") to extend input types.
type SectionFieldDef =
    | {
          type: "days";
          key: "days";
          header: string;
          size?: number;
          hug?: boolean;
      }
    | {
          type: "text";
          key: SectionFieldKey;
          header: string;
          placeholder: string;
          size?: number;
          hug?: boolean;
      }
    | {
          type: "time";
          key: SectionFieldKey;
          header: string;
          size?: number;
          hug?: boolean;
      }
    | {
          type: "combobox";
          key: SectionFieldKey;
          header: string;
          placeholder: string;
          size?: number;
          hug?: boolean;
      };

const SECTION_FIELDS: readonly SectionFieldDef[] = [
    {
        type: "days",
        key: "days",
        header: "Days",
        hug: true,
    },
    {
        type: "time",
        key: "time",
        header: "Time",
        hug: true,
    },
    {
        type: "text",
        key: "crn",
        header: "CRN",
        placeholder: "12345",
        size: 100,
    },
    {
        type: "combobox",
        key: "instructor",
        header: "Instructor",
        placeholder: "Smith",
    },
];

function createEmptySectionDraft(): SectionDraft {
    return {
        days: "",
        time: "",
        crn: "",
        instructor: "",
    };
}

export type ComboboxFieldOptions = {
    options: string[];
    onCreateOption?: (value: string) => void;
};

export type RequirementSectionsTableProps = {
    sections: SectionRef[];
    onUpdateSection: (rowIndex: number, patch: Partial<SectionRef>) => void;
    onRemoveSection: (rowIndex: number) => void;
    onCopySection: (rowIndex: number) => void;
    onAddSection: (sectionData: Partial<SectionRef>) => void;
    fieldOptions?: Partial<Record<SectionFieldKey, ComboboxFieldOptions>>;
};

const ACTION_BUTTON_BASE = "transition-colors text-sm px-2 py-1";
const ACTION_BUTTON_ENABLED = `${ACTION_BUTTON_BASE} text-background/40 hover:text-background/70`;
const ACTION_BUTTON_DISABLED = `${ACTION_BUTTON_BASE} text-background/15 cursor-not-allowed`;

function getColumnSizeStyle(
    size?: number,
    meta?: unknown,
): CSSProperties | undefined {
    const isHug = meta && typeof meta === "object" && "hug" in meta && meta.hug;

    if (isHug) {
        return {
            width: "1%",
            whiteSpace: "nowrap",
        };
    }

    if (!size) return undefined;

    return {
        width: `${size}px`,
        minWidth: `${size}px`,
    };
}

export function RequirementSectionsTable({
    sections,
    onUpdateSection,
    onRemoveSection,
    onCopySection,
    onAddSection,
    fieldOptions = {},
}: RequirementSectionsTableProps) {
    const [newSection, setNewSection] = useState<SectionDraft>(
        createEmptySectionDraft,
    );

    const data = useMemo<RequirementSectionRow[]>(
        () =>
            sections.map((section, index) => ({
                ...section,
                rowKey: `${section.crn || "section"}-${index}`,
            })),
        [sections],
    );

    const columns = useMemo<ColumnDef<RequirementSectionRow>[]>(() => {
        function makeColumn(
            field: SectionFieldDef,
        ): ColumnDef<RequirementSectionRow> {
            const base = {
                id: field.key,
                accessorFn: (row: RequirementSectionRow) =>
                    row[field.key] ?? "",
                header: field.header,
                size: field.size,
                meta: { hug: field.hug },
            };

            switch (field.type) {
                case "days":
                    return {
                        ...base,
                        cell: ({ row, getValue }) => (
                            <DaysInput
                                value={String(getValue() || "")}
                                onChange={(value) =>
                                    onUpdateSection(row.index, {
                                        days: value,
                                    })
                                }
                            />
                        ),
                    };
                case "text":
                    return {
                        ...base,
                        cell: ({ row, getValue }) => (
                            <EditableTextCell
                                value={String(getValue() || "")}
                                onCommit={(value) =>
                                    onUpdateSection(row.index, {
                                        [field.key]: value,
                                    } as Partial<SectionRef>)
                                }
                            />
                        ),
                    };
                case "time":
                    return {
                        ...base,
                        cell: ({ row, getValue }) => (
                            <TimeRangeInput
                                value={String(getValue() || "")}
                                onChange={(value) =>
                                    onUpdateSection(row.index, {
                                        [field.key]: value,
                                    } as Partial<SectionRef>)
                                }
                            />
                        ),
                    };
                case "combobox": {
                    const opts = fieldOptions[field.key];
                    return {
                        ...base,
                        cell: ({ row, getValue }) => (
                            <Combobox
                                value={String(getValue() || "")}
                                options={opts?.options ?? []}
                                onChange={(value) =>
                                    onUpdateSection(row.index, {
                                        [field.key]: value,
                                    } as Partial<SectionRef>)
                                }
                                onCreateOption={opts?.onCreateOption}
                                placeholder={field.placeholder}
                            />
                        ),
                    };
                }
            }
        }

        return [
            {
                id: "required",
                header: "Required",
                columns: SECTION_FIELDS.filter(
                    (f) => f.key === "days" || f.key === "time",
                ).map(makeColumn),
            },
            {
                id: "optional",
                header: "Optional",
                columns: SECTION_FIELDS.filter(
                    (f) => f.key === "crn" || f.key === "instructor",
                ).map(makeColumn),
            },
            {
                id: "actions",
                header: "",
                meta: { hug: true },
                cell: ({ row }) => (
                    <div className="flex justify-end gap-0.5">
                        <button
                            type="button"
                            onClick={() => onCopySection(row.index)}
                            className={ACTION_BUTTON_ENABLED}
                            aria-label="Copy section"
                        >
                            <FaRegCopy />
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemoveSection(row.index)}
                            disabled={sections.length == 0}
                            className={
                                sections.length > 0
                                    ? `${ACTION_BUTTON_ENABLED} hover:!text-red-500`
                                    : ACTION_BUTTON_DISABLED
                            }
                            aria-label="Remove section"
                        >
                            <FaRegTrashAlt />
                        </button>
                        <button
                            type="button"
                            disabled
                            className={ACTION_BUTTON_DISABLED}
                            aria-label="Add section"
                        >
                            <FaPlus />
                        </button>
                    </div>
                ),
            },
        ];
    }, [
        onRemoveSection,
        onCopySection,
        onUpdateSection,
        sections.length,
        fieldOptions,
    ]);

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

    function updateDraftField(key: SectionFieldKey, value: string) {
        setNewSection((current) => ({ ...current, [key]: value }));
    }

    function renderFooterInput(field: SectionFieldDef) {
        switch (field.type) {
            case "days":
                return (
                    <DaysInput
                        value={newSection.days}
                        onChange={(value) => updateDraftField("days", value)}
                    />
                );
            case "text":
                return (
                    <input
                        type="text"
                        value={newSection[field.key]}
                        onChange={(e) =>
                            updateDraftField(field.key, e.target.value)
                        }
                        onKeyDown={handleAddRowKeyDown}
                        className="w-full bg-transparent outline-none border border-transparent rounded px-2 py-1 focus:border-accent hover:border-background/20 text-sm"
                        placeholder={field.placeholder}
                        aria-label={`New section ${field.header}`}
                    />
                );
            case "time":
                return (
                    <TimeRangeInput
                        value={newSection[field.key]}
                        onChange={(value) => updateDraftField(field.key, value)}
                    />
                );
            case "combobox": {
                const opts = fieldOptions[field.key];
                return (
                    <Combobox
                        value={newSection[field.key]}
                        options={opts?.options ?? []}
                        onChange={(value) => updateDraftField(field.key, value)}
                        onCreateOption={opts?.onCreateOption}
                        placeholder={field.placeholder}
                    />
                );
            }
        }
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
                                    style={
                                        isGroupHeader
                                            ? undefined
                                            : getColumnSizeStyle(
                                                  header.column.columnDef.size,
                                                  header.column.columnDef.meta,
                                              )
                                    }
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
                <tr className="border-b border-background/10 hover:bg-background/5 transition-colors">
                    {table.getAllLeafColumns().map((column) => {
                        if (column.id === "actions") {
                            return (
                                <td
                                    key={column.id}
                                    style={getColumnSizeStyle(
                                        column.columnDef.size,
                                        column.columnDef.meta,
                                    )}
                                    className="p-2 align-middle border-b border-background/10"
                                >
                                    <div className="flex justify-end gap-0.5">
                                        <button
                                            type="button"
                                            disabled
                                            className={ACTION_BUTTON_DISABLED}
                                            aria-label="Copy section"
                                        >
                                            <FaRegCopy />
                                        </button>
                                        <button
                                            type="button"
                                            disabled
                                            className={ACTION_BUTTON_DISABLED}
                                            aria-label="Remove section"
                                        >
                                            <FaRegTrashAlt />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddSection}
                                            disabled={!canAddSection}
                                            className={
                                                canAddSection
                                                    ? `${ACTION_BUTTON_ENABLED} !text-accent hover:!text-accent/80`
                                                    : ACTION_BUTTON_DISABLED
                                            }
                                            aria-label="Add section"
                                        >
                                            <FaPlus />
                                        </button>
                                    </div>
                                </td>
                            );
                        }

                        const field = SECTION_FIELDS.find(
                            (item) => item.key === column.id,
                        );

                        if (!field) {
                            return (
                                <td
                                    key={column.id}
                                    className="p-2 border-b border-background/10"
                                />
                            );
                        }

                        return (
                            <td
                                key={column.id}
                                style={getColumnSizeStyle(
                                    column.columnDef.size,
                                    column.columnDef.meta,
                                )}
                                className="p-2 align-middle text-background border-b border-background/10"
                            >
                                {renderFooterInput(field)}
                            </td>
                        );
                    })}
                </tr>

                {table.getRowModel().rows.map((row) => (
                    <tr
                        key={row.id}
                        className="border-b border-background/10 hover:bg-background/5 transition-colors"
                    >
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                style={getColumnSizeStyle(
                                    cell.column.columnDef.size,
                                    cell.column.columnDef.meta,
                                )}
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
        </table>
    );
}
