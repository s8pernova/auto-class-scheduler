import type {
    CatalogSectionsReplaceRequest,
    ScheduleGenerateMetadata,
    ScheduleGenerateRequest,
} from "@/api/client";
import type {
    ScheduleDraft,
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
        maxResults: 100,
    };
}
