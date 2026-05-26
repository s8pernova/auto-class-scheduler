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
    canGenerate: boolean;
    onUpdateCourseLabel: (label: string) => void;
    onUpdateSection: (rowIndex: number, patch: Partial<SectionRef>) => void;
    onRemoveSection: (rowIndex: number) => void;
    onCopySection: (rowIndex: number) => void;
    onAddSection: (sectionData: Partial<SectionRef>) => void;
    onGenerate: () => void;
    fieldOptions?: Partial<Record<string, ComboboxFieldOptions>>;
};

export function CourseDetailPanel({
    selectedCourse,
    canGenerate,
    onUpdateCourseLabel,
    onUpdateSection,
    onRemoveSection,
    onCopySection,
    onAddSection,
    onGenerate,
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

            <div className="mt-auto flex justify-end pt-4 border-t border-background/10">
                <button
                    type="button"
                    onClick={onGenerate}
                    disabled={!canGenerate}
                    className="px-6 py-2 bg-accent text-white rounded-md font-bold disabled:opacity-50 hover:bg-accent/90 transition-colors"
                >
                    Generate Schedules
                </button>
            </div>
        </main>
    );
}
