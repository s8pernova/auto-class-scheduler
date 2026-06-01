import { FaRegTrashAlt, FaPlus } from "react-icons/fa";
import type { RequirementCourse } from "@/contexts/ScheduleDraftContext";

type RequirementsSidebarProps = {
    courses: RequirementCourse[];
    selectedCourseId: string | null;
    highlightedCourseId: string | null;
    onSelectCourse: (id: string) => void;
    onAddCourse: (e: React.FormEvent<HTMLFormElement>) => void;
    onRemoveCourse: (id: string, e: React.MouseEvent) => void;
};

export function RequirementsSidebar({
    courses,
    selectedCourseId,
    highlightedCourseId,
    onSelectCourse,
    onAddCourse,
    onRemoveCourse,
}: RequirementsSidebarProps) {
    return (
        <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide">
                Requirements
            </h2>

            <form onSubmit={onAddCourse} className="flex gap-2">
                <input
                    type="text"
                    name="courseInput"
                    placeholder="e.g. CS 2104"
                    maxLength={15}
                    required
                    className="flex-1 px-3 py-2 border border-background/20 rounded-md bg-transparent focus:border-accent outline-none transition-colors"
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-accent text-white rounded-md font-medium hover:bg-accent/90 transition-colors"
                >
                    <FaPlus />
                </button>
            </form>

            <div className="flex flex-col gap-2 overflow-y-auto mt-2">
                {courses.length === 0 ? (
                    <p className="text-sm text-background/40 italic">
                        No requirements added yet.
                    </p>
                ) : (
                    courses.map((group) => {
                        const isSelected = group.id === selectedCourseId;
                        const isHighlighted = group.id === highlightedCourseId;

                        return (
                            <div
                                key={group.id}
                                onClick={() => onSelectCourse(group.id)}
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
                                        {group.sections.length} candidate{" "}
                                        {group.sections.length === 1
                                            ? "section"
                                            : "sections"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => onRemoveCourse(group.id, e)}
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
    );
}
