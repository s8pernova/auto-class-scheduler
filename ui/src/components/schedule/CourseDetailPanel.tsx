import type {
    RequirementCourse,
    SectionRef,
} from "@/contexts/ScheduleDraftContext";
import {
    RequirementSectionsTable,
    type ComboboxFieldOptions,
} from "./RequirementSectionsTable";

type CourseDetailPanelProps = {
    selectedCourse: RequirementCourse | undefined;
    canContinue: boolean;
    onUpdateCourseLabel: (label: string) => void;
    onUpdateSection: (rowIndex: number, patch: Partial<SectionRef>) => void;
    onRemoveSection: (rowIndex: number) => void;
    onCopySection: (rowIndex: number) => void;
    onAddSection: (sectionData: Partial<SectionRef>) => void;
    onContinue: () => void;
    isContinuing?: boolean;
    continueLabel?: string;
    continuingLabel?: string;
    continueError?: string | null;
    shareUrl?: string | null;
    onCopyShareUrl?: () => void;
    copyShareLabel?: string;
    fieldOptions?: Partial<Record<string, ComboboxFieldOptions>>;
};

export default function CourseDetailPanel({
    selectedCourse,
    canContinue,
    onUpdateCourseLabel,
    onUpdateSection,
    onRemoveSection,
    onCopySection,
    onAddSection,
    onContinue,
    isContinuing = false,
    continueLabel = "Continue",
    continuingLabel = "Saving...",
    continueError = null,
    shareUrl = null,
    onCopyShareUrl,
    copyShareLabel = "Copy Link",
    fieldOptions,
}: CourseDetailPanelProps) {
    return (
        <main className="bg-surface rounded-[10px] p-6 flex flex-col">
            {!selectedCourse ? (
                <div className="flex-1 flex flex-col text-background/40">
                    <h1 className="text-xl font-semibold mb-2 text-background/60">
                        Build Your Schedule
                    </h1>
                    <p>
                        Add a requirement on the left, or select an existing one
                        to edit its allowed courses.
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
                                    onUpdateCourseLabel(e.target.value)
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
                            onUpdateSection={onUpdateSection}
                            onRemoveSection={onRemoveSection}
                            onCopySection={onCopySection}
                            onAddSection={onAddSection}
                            fieldOptions={fieldOptions}
                        />
                    </div>
                </div>
            )}

            <div className="mt-auto">
                {shareUrl ? (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-background/10 bg-background/5 px-3 py-2 text-sm">
                        <a
                            href={shareUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-background/70 hover:text-accent"
                        >
                            {shareUrl}
                        </a>
                        <button
                            type="button"
                            onClick={onCopyShareUrl}
                            className="px-3 py-1.5 rounded-md border border-background/15 text-background/70 font-semibold hover:bg-background/10 transition-colors"
                        >
                            {copyShareLabel}
                        </button>
                    </div>
                ) : null}

                {continueError ? (
                    <div className="mb-4 border border-red-500/40 bg-red-500/10 text-red-700 rounded-md px-3 py-2 text-sm">
                        {continueError}
                    </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-background/10">
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={!canContinue || isContinuing}
                        className="px-6 py-2 bg-accent text-white rounded-md font-bold disabled:opacity-50 hover:bg-accent/90 transition-colors"
                    >
                        {isContinuing ? continuingLabel : continueLabel}
                    </button>
                </div>
            </div>
        </main>
    );
}
