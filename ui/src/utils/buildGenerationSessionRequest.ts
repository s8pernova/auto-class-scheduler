import type {
    CatalogSectionsReplaceRequest,
    ScheduleGenerateMetadata,
    ScheduleGenerateRequirements,
    ScheduleGenerationSessionCreateRequest,
} from "@/api";
import type {
    ScheduleDraft,
    RequirementGroup,
    SectionRef,
} from "@/contexts/ScheduleDraftContext";

function optionalString(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function splitTimeRange(value: string): { startTime: string; endTime: string } {
    const [startTime = "", endTime = ""] = value
        .split("-")
        .map((part) => part.trim());

    if (!startTime || !endTime) {
        throw new Error("Each section needs both a start and end time.");
    }

    return { startTime, endTime };
}

function buildMeeting(section: SectionRef) {
    if (!section.days.trim()) {
        throw new Error("Each section needs meeting days.");
    }

    return {
        days: section.days.trim(),
        ...splitTimeRange(section.time),
    };
}

function buildDefaultRequirementGroups(
    draft: ScheduleDraft,
): RequirementGroup[] {
    return draft.requirementCourses.map((course) => ({
        id: `group-${course.id}`,
        courseIds: [course.id],
        choose: 1,
    }));
}

function buildScheduleRequirements(
    draft: ScheduleDraft,
): ScheduleGenerateRequirements {
    const courseNamesById = new Map(
        draft.requirementCourses.map((course) => [course.id, course.label]),
    );
    const groups =
        draft.requirementGroups.length > 0
            ? draft.requirementGroups
            : buildDefaultRequirementGroups(draft);

    return {
        groups: groups.map((group) => {
            const courseNames = group.courseIds
                .map((courseId) => courseNamesById.get(courseId)?.trim())
                .filter((courseName): courseName is string =>
                    Boolean(courseName),
                );

            if (courseNames.length === 0) {
                throw new Error("Each requirement group needs a course.");
            }

            return {
                name: group.name,
                courseNames,
                choose: group.choose,
            };
        }),
    };
}

export function buildCatalogSectionsReplaceRequest(
    draft: ScheduleDraft,
): CatalogSectionsReplaceRequest {
    return {
        sections: draft.requirementCourses.map((course, courseIndex) => {
            if (course.sections.length === 0) {
                throw new Error(`${course.label} needs at least one section.`);
            }

            return {
                courseName: course.label,
                sortOrder: courseIndex,
                meetings: course.sections.map((section, sectionIndex) => {
                    const crn = optionalString(section.crn);
                    const instructorName = optionalString(section.instructor);

                    return {
                        crn,
                        instructorName,
                        ...buildMeeting(section),
                        sortOrder: sectionIndex,
                    };
                }),
            };
        }),
    };
}

export function buildGenerationSessionRequest(
    draft: ScheduleDraft,
    metadata: Partial<ScheduleGenerateMetadata> = {},
): ScheduleGenerationSessionCreateRequest {
    return {
        metadata: {
            catalogId: draft.catalogId,
            ...metadata,
        },
        filters: draft.generationView.filters,
        instructorRatings: draft.instructorRatings,
        requirements: buildScheduleRequirements(draft),
        sort: draft.generationView.sort,
        page: {
            limit: draft.generationView.pageLimit,
        },
    };
}
