import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    type RequirementCourse,
    type InstructorRatings as InstructorRatingsMap,
    type SectionRef,
    useScheduleDraft,
} from "@/contexts/ScheduleDraftContext";
import {
    generateSchedules,
    getScheduleLimits,
    replaceCatalogSections,
    type ScheduleLimitsResponse,
} from "@/api";
import {
    buildCatalogSectionsReplaceRequest,
    buildScheduleGenerateRequest,
} from "@/utils/buildScheduleGenerateRequest";
import { parseCourseInput } from "@/utils/parseCourseInput";
import RequirementsSidebar from "@/components/schedule/RequirementsSidebar";
import CourseDetailPanel from "@/components/schedule/CourseDetailPanel";
import InstructorRatings from "@/components/schedule/InstructorRatings";

export default function ScheduleRequestStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const {
        draft,
        updateCatalogDraft,
        updateScheduleRequest,
        setGenerationResult,
        shareSlug,
        catalogStatus,
        isCatalogLoading,
        catalogError,
        isDraftLoading,
        draftError,
        isCatalogDraftDirty,
        ensureEditableCatalog,
        markCatalogDraftClean,
        publishCurrentCatalog,
    } = useScheduleDraft();
    const navigate = useNavigate();

    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
        null,
    );
    const [highlightedCourseId, setHighlightedCourseId] = useState<
        string | null
    >(null);
    const [createdInstructors, setCreatedInstructors] = useState<string[]>([]);
    const [ignoredInstructorNames, setIgnoredInstructorNames] = useState<
        string[]
    >([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copyShareLabel, setCopyShareLabel] = useState("Copy Link");
    const [limits, setLimits] = useState<ScheduleLimitsResponse | null>(null);

    const selectedCourse = draft.requirementCourses.find(
        (group) => group.id === selectedCourseId,
    );

    const committedInstructorNames = useMemo(() => {
        const names = new Set<string>();
        for (const course of draft.requirementCourses) {
            for (const section of course.sections) {
                const instructor = section.instructor?.trim();
                if (instructor) {
                    names.add(instructor);
                }
            }
        }

        return [...names].sort((a, b) => a.localeCompare(b));
    }, [draft.requirementCourses]);

    // Created names feed the combobox, but the preferences panel only uses
    // names that have been committed into section rows.
    const instructorOptions = useMemo(() => {
        const names = new Set<string>([
            ...createdInstructors,
            ...committedInstructorNames,
        ]);

        return [...names].sort((a, b) => a.localeCompare(b));
    }, [committedInstructorNames, createdInstructors]);

    const canContinue =
        draft.requirementCourses.length > 0 &&
        draft.requirementCourses.every((course) => course.sections.length > 0);
    const isCourseLimitReached =
        limits !== null &&
        draft.requirementCourses.length >= limits.maxCatalogCourses;
    const isAddCourseDisabled = limits === null || isCourseLimitReached;
    const shareUrl = shareSlug
        ? `${window.location.origin}/c/${shareSlug}`
        : null;

    useEffect(() => {
        let isCurrent = true;

        getScheduleLimits()
            .then((result) => {
                if (isCurrent) {
                    setLimits(result);
                }
            })
            .catch((err) => {
                setSaveError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch schedule limits.",
                );
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    if (isDraftLoading || isCatalogLoading) {
        return (
            <div className="h-full col-span-full flex items-center justify-center text-background/50 text-sm">
                Loading catalog.
            </div>
        );
    }

    if (draftError || catalogError) {
        return (
            <div className="h-full col-span-full flex items-center justify-center text-background/60 text-sm">
                {draftError ?? catalogError}
            </div>
        );
    }

    async function saveCatalogDraftIfNeeded({
        force = false,
    }: {
        force?: boolean;
    } = {}): Promise<{
        targetCatalogId: string;
        targetCatalog: Awaited<ReturnType<typeof ensureEditableCatalog>> | null;
        targetDraft: typeof draft;
    }> {
        if (!catalogId || (!force && !isCatalogDraftDirty)) {
            return {
                targetCatalogId: catalogId ?? draft.catalogId,
                targetCatalog: null,
                targetDraft: draft,
            };
        }

        const targetCatalog = await ensureEditableCatalog();
        const targetCatalogId = targetCatalog.id;
        const targetDraft = {
            ...draft,
            catalogId: targetCatalogId,
        };

        const payload = buildCatalogSectionsReplaceRequest(targetDraft);
        await replaceCatalogSections(targetCatalogId, payload);
        markCatalogDraftClean();

        return {
            targetCatalogId,
            targetCatalog,
            targetDraft,
        };
    }

    async function handleSaveDraft() {
        if (!catalogId) return;

        setSaveError(null);
        setIsSavingDraft(true);

        try {
            const { targetCatalogId, targetCatalog, targetDraft } =
                await saveCatalogDraftIfNeeded({ force: true });

            if (targetCatalogId !== catalogId) {
                navigate(`/catalogs/${targetCatalogId}`, {
                    replace: true,
                    state: {
                        source: "forked_catalog",
                        catalog: targetCatalog,
                        draft: targetDraft,
                    },
                });
            }
        } catch (err) {
            setSaveError(
                err instanceof Error ? err.message : "Failed to save draft.",
            );
        } finally {
            setIsSavingDraft(false);
        }
    }

    async function publishCatalogIfNeeded({
        targetCatalogId,
        targetCatalog,
    }: {
        targetCatalogId: string;
        targetCatalog: Awaited<ReturnType<typeof ensureEditableCatalog>> | null;
    }): Promise<Awaited<ReturnType<typeof ensureEditableCatalog>> | null> {
        if ((targetCatalog?.status ?? catalogStatus) === "published") {
            return targetCatalog;
        }

        return publishCurrentCatalog(targetCatalogId);
    }

    async function handleContinue() {
        if (!catalogId) return;

        setSaveError(null);
        setIsGenerating(true);

        try {
            const { targetCatalogId, targetCatalog, targetDraft } =
                await saveCatalogDraftIfNeeded();
            const publishedCatalog = await publishCatalogIfNeeded({
                targetCatalogId,
                targetCatalog,
            });

            const generationPayload = buildScheduleGenerateRequest(targetDraft);
            const generationResult = await generateSchedules(generationPayload);
            const draftWithResults = {
                ...targetDraft,
                generationResult,
            };

            if (targetCatalogId !== catalogId) {
                navigate(`/catalogs/${targetCatalogId}/results`, {
                    replace: true,
                    state: {
                        source: "forked_catalog",
                        catalog: publishedCatalog,
                        draft: draftWithResults,
                    },
                });
                return;
            }

            setGenerationResult(generationResult);
            navigate(`/catalogs/${targetCatalogId}/results`);
        } catch (err) {
            setSaveError(
                err instanceof Error
                    ? err.message
                    : "Failed to generate schedules.",
            );
            setIsGenerating(false);
        }
    }

    async function handleCopyShareUrl() {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopyShareLabel("Copied");
            window.setTimeout(() => setCopyShareLabel("Copy Link"), 1500);
        } catch {
            setSaveError("Failed to copy share link.");
        }
    }

    function handleAddCourse(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const rawInput = String(formData.get("courseInput") || "");
        const parsed = parseCourseInput(rawInput);

        if (!parsed) {
            alert("Please enter a course name.");
            return;
        }

        const label = parsed;

        if (limits === null) {
            alert("Course limits are still loading.");
            return;
        }

        if (isCourseLimitReached) {
            alert(
                `You can add up to ${limits.maxCatalogCourses} course requirements.`,
            );
            return;
        }

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

        const slug = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const id = `req-${slug || "course"}-${Date.now()}`;

        const newGroup: RequirementCourse = {
            id,
            label,
            sections: [],
        };

        updateCatalogDraft({
            requirementCourses: [...draft.requirementCourses, newGroup],
        });
        updateScheduleRequest({
            requirementGroups: [
                ...draft.requirementGroups,
                {
                    id: `group-${id}`,
                    courseIds: [id],
                    choose: 1,
                },
            ],
        });
        setSelectedCourseId(id);
        e.currentTarget.reset();
    }

    function removeCourse(id: string, e: React.MouseEvent) {
        e.stopPropagation();

        const requirementGroups = draft.requirementGroups
            .map((group) => {
                const courseIds = group.courseIds.filter(
                    (courseId) => courseId !== id,
                );

                return {
                    ...group,
                    courseIds,
                    choose: Math.min(group.choose, courseIds.length),
                };
            })
            .filter((group) => group.courseIds.length > 0 && group.choose > 0);

        updateCatalogDraft({
            requirementCourses: draft.requirementCourses.filter(
                (group) => group.id !== id,
            ),
        });
        updateScheduleRequest({
            requirementGroups,
        });

        if (selectedCourseId === id) {
            setSelectedCourseId(null);
        }
    }

    function handleUpdateCourse(
        groupId: string,
        patch: Partial<RequirementCourse>,
    ) {
        updateCatalogDraft({
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

        const newSection: SectionRef = {
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

    function handleInstructorRatingChange(
        instructorName: string,
        rating: number | null,
    ) {
        updateScheduleRequest({
            instructorRatings: {
                ...draft.instructorRatings,
                [instructorName]: rating,
            },
        });
        setIgnoredInstructorNames((prev) =>
            prev.filter((name) => name !== instructorName),
        );
    }

    function omitInstructorRating(
        ratings: InstructorRatingsMap,
        instructorName: string,
    ): InstructorRatingsMap {
        return Object.fromEntries(
            Object.entries(ratings).filter(([name]) => name !== instructorName),
        );
    }

    function handleIgnoreInstructor(instructorName: string) {
        updateScheduleRequest({
            instructorRatings: omitInstructorRating(
                draft.instructorRatings,
                instructorName,
            ),
        });
        setIgnoredInstructorNames((prev) =>
            prev.includes(instructorName) ? prev : [...prev, instructorName],
        );
    }

    function handleRestoreInstructor(instructorName: string) {
        setIgnoredInstructorNames((prev) =>
            prev.filter((name) => name !== instructorName),
        );
    }

    return (
        <>
            <RequirementsSidebar
                courses={draft.requirementCourses}
                selectedCourseId={selectedCourseId}
                highlightedCourseId={highlightedCourseId}
                isAddCourseDisabled={isAddCourseDisabled}
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
                onSaveDraft={handleSaveDraft}
                canSaveDraft={isCatalogDraftDirty}
                isSavingDraft={isSavingDraft}
                saveDraftLabel={isCatalogDraftDirty ? "Save Draft" : "Saved"}
                savingDraftLabel="Saving..."
                onContinue={handleContinue}
                isContinuing={isGenerating}
                continueLabel="Generate Schedules"
                continuingLabel="Generating..."
                continueError={saveError}
                shareUrl={shareUrl}
                onCopyShareUrl={handleCopyShareUrl}
                copyShareLabel={copyShareLabel}
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

            <InstructorRatings
                instructorNames={committedInstructorNames}
                ignoredInstructorNames={ignoredInstructorNames}
                ratings={draft.instructorRatings}
                onSetRating={handleInstructorRatingChange}
                onIgnoreInstructor={handleIgnoreInstructor}
                onRestoreInstructor={handleRestoreInstructor}
            />
        </>
    );
}
