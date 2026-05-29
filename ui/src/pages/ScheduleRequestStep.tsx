import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    type RequirementCourse,
    type SectionRef,
    useScheduleDraft,
} from "@/contexts/ScheduleDraftContext";
import { replaceCatalogSections } from "@/api/client";
import { buildCatalogSectionsReplaceRequest } from "@/utils/buildScheduleGenerateRequest";
import { parseCourseInput } from "@/utils/parseCourseInput";
import { RequirementsSidebar } from "@/components/schedule/RequirementsSidebar";
import { CourseDetailPanel } from "@/components/schedule/CourseDetailPanel";

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
    const [createdInstructors, setCreatedInstructors] = useState<string[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const selectedCourse = draft.requirementCourses.find(
        (group) => group.id === selectedCourseId,
    );

    // Collect unique instructor names from all sections + manually created ones
    const instructorOptions = useMemo(() => {
        const names = new Set<string>(createdInstructors);
        for (const course of draft.requirementCourses) {
            for (const section of course.sections) {
                if (section.instructor) {
                    names.add(section.instructor);
                }
            }
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [draft.requirementCourses, createdInstructors]);

    const canContinue =
        draft.requirementCourses.length > 0 &&
        draft.requirementCourses.every((course) => course.sections.length > 0);

    async function handleContinue() {
        if (!catalogId) return;

        setSaveError(null);
        setIsSaving(true);

        try {
            const payload = buildCatalogSectionsReplaceRequest(draft);
            await replaceCatalogSections(catalogId, payload);
            navigate(`/catalogs/${catalogId}/instructors`);
        } catch (err) {
            setSaveError(
                err instanceof Error
                    ? err.message
                    : "Failed to save catalog sections.",
            );
            setIsSaving(false);
        }
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
        sectionData: Partial<SectionRef>,
        groupId: string,
    ) {
        const group = draft.requirementCourses.find(
            (item) => item.id === groupId,
        );
        if (!group) return;

        const parsedGroupCourse = parseCourseInput(group.label);
        if (!parsedGroupCourse) {
            // TODO: change the some other form of feedback with better UI
            alert("Group label is not a valid course format.");
            return;
        }

        const newSection: SectionRef = {
            subjectCode: parsedGroupCourse.subjectCode,
            courseNumber: parsedGroupCourse.courseNumber,
            days: sectionData.days || "",
            time: sectionData.time || "",
            crn: sectionData.crn || "",
            instructor: sectionData.instructor || "",
        };

        handleUpdateCourse(groupId, {
            sections: [newSection, ...group.sections],
        });
    }

    function handleUpdateSectionAtIndex(
        groupId: string,
        rowIndex: number,
        patch: Partial<SectionRef>,
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
        if (!group) return;

        const nextSections = group.sections.filter(
            (_, index) => index !== rowIndex,
        );

        handleUpdateCourse(groupId, {
            sections: nextSections,
        });
    }

    function handleCopySectionAtIndex(groupId: string, rowIndex: number) {
        const group = draft.requirementCourses.find(
            (item) => item.id === groupId,
        );
        if (!group) return;

        const source = group.sections[rowIndex];
        if (!source) return;

        const copy = { ...source };
        const nextSections = [
            ...group.sections.slice(0, rowIndex + 1),
            copy,
            ...group.sections.slice(rowIndex + 1),
        ];

        handleUpdateCourse(groupId, { sections: nextSections });
    }

    return (
        <>
            <RequirementsSidebar
                courses={draft.requirementCourses}
                selectedCourseId={selectedCourseId}
                highlightedCourseId={highlightedCourseId}
                onSelectCourse={setSelectedCourseId}
                onAddCourse={handleAddCourse}
                onRemoveCourse={removeCourse}
            />

            <CourseDetailPanel
                selectedCourse={selectedCourse}
                canContinue={canContinue}
                onUpdateCourseLabel={(label) => {
                    if (selectedCourse) {
                        handleUpdateCourse(selectedCourse.id, { label });
                    }
                }}
                onUpdateSection={(rowIndex, patch) => {
                    if (selectedCourse) {
                        handleUpdateSectionAtIndex(
                            selectedCourse.id,
                            rowIndex,
                            patch,
                        );
                    }
                }}
                onRemoveSection={(rowIndex) => {
                    if (selectedCourse) {
                        handleRemoveSectionAtIndex(selectedCourse.id, rowIndex);
                    }
                }}
                onCopySection={(rowIndex) => {
                    if (selectedCourse) {
                        handleCopySectionAtIndex(selectedCourse.id, rowIndex);
                    }
                }}
                onAddSection={(sectionData) => {
                    if (selectedCourse) {
                        handleAddSectionToCourse(
                            sectionData,
                            selectedCourse.id,
                        );
                    }
                }}
                onContinue={handleContinue}
                isContinuing={isSaving}
                continueError={saveError}
                fieldOptions={{
                    instructor: {
                        options: instructorOptions,
                        onCreateOption: (name) =>
                            setCreatedInstructors((prev) =>
                                prev.includes(name) ? prev : [...prev, name],
                            ),
                    },
                }}
            />

        </>
    );
}
