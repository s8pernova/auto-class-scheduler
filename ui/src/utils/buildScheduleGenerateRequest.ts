import type {
    CatalogSectionsReplaceRequest,
    ScheduleGenerateMetadata,
    ScheduleGenerateRequest,
    ScheduleGenerateRequirements,
} from "@/api/client";
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
    let sortOrder = 0;

    return {
        sections: draft.requirementCourses.flatMap((course) => {
            if (course.sections.length === 0) {
                throw new Error(`${course.label} needs at least one section.`);
            }

            return course.sections.map((section) => {
                const crn = optionalString(section.crn);
                const instructorName = optionalString(section.instructor);
                const currentSortOrder = sortOrder;
                sortOrder += 1;

                return {
                    courseName: course.label,
                    crn,
                    instructorName,
                    sortOrder: currentSortOrder,
                    meetings: [{ ...buildMeeting(section), sortOrder: 0 }],
                };
            });
        }),
    };
}

export function buildScheduleGenerateRequest(
    draft: ScheduleDraft,
    metadata: Partial<ScheduleGenerateMetadata> = {},
): ScheduleGenerateRequest {
    return {
        metadata: {
            catalogId: draft.catalogId,
            ...metadata,
        },
        preferences: {
            blockedTimes: draft.blockedTimes.map((blockedTime) => ({
                days: blockedTime.dayOfWeek,
                startTime: blockedTime.startTime,
                endTime: blockedTime.endTime,
            })),
            instructorRatings: draft.instructorRatings,
        },
        requirements: buildScheduleRequirements(draft),
        maxResults: 100,
    };
}
