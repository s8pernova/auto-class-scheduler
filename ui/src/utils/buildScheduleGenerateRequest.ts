import type {
    ScheduleGenerateMetadata,
    ScheduleGenerateRequest,
} from "@/api/client";
import type {
    ScheduleDraft,
    SectionRef,
} from "@/contexts/ScheduleDraftContext";
import { parseCourseInput } from "@/utils/parseCourseInput";

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

function getInstructorRating(
    draft: ScheduleDraft,
    instructorName: string | undefined,
): number | null | undefined {
    if (!instructorName) return undefined;

    return Object.prototype.hasOwnProperty.call(
        draft.instructorRatings,
        instructorName,
    )
        ? draft.instructorRatings[instructorName]
        : undefined;
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

export function buildScheduleGenerateRequest(
    draft: ScheduleDraft,
    metadata: Partial<ScheduleGenerateMetadata> = {},
): ScheduleGenerateRequest {
    return {
        metadata: {
            catalogId: draft.catalogId,
            ...metadata,
        },
        courses: draft.requirementCourses.map((course) => {
            const parsed = parseCourseInput(course.label);

            if (!parsed) {
                throw new Error(`${course.label} is not a valid course code.`);
            }
            if (course.sections.length === 0) {
                throw new Error(`${course.label} needs at least one section.`);
            }

            return {
                subjectCode: parsed.subjectCode,
                courseNumber: parsed.courseNumber,
                sections: course.sections.map((section) => {
                    const crn = optionalString(section.crn);
                    const instructorName = optionalString(section.instructor);

                    return {
                        sectionCode: crn,
                        crn,
                        instructorName,
                        instructorRating: getInstructorRating(
                            draft,
                            instructorName,
                        ),
                        meetings: [buildMeeting(section)],
                    };
                }),
            };
        }),
        preferences: {
            blockedTimes: draft.blockedTimes.map((blockedTime) => ({
                days: blockedTime.dayOfWeek,
                startTime: blockedTime.startTime,
                endTime: blockedTime.endTime,
            })),
            allowCampusSwitch: false,
            allowFullSections: draft.preferences.allowFullSections,
            allowRestrictedSections: draft.preferences.allowRestrictedSections,
            campuses: draft.preferences.campuses ?? [],
            times: draft.preferences.times ?? [],
        },
        maxResults: 100,
    };
}
