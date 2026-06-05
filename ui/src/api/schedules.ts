import { apiFetch } from "@/api/http";

interface GetSchedulesOptions {
    favoritesOnly?: boolean;
    limit?: number;
    offset?: number;
    campusPatterns?: string[] | null;
    times?: string[] | null;
}

export interface ScheduleGenerateMetadata {
    catalogId?: string;
}

export interface ScheduleGenerateBlockedTimeInput {
    days: string;
    startTime: string;
    endTime: string;
}

export interface ScheduleGeneratePreferences {
    blockedTimes: ScheduleGenerateBlockedTimeInput[];
    instructorRatings: Record<string, number | null>;
}

export interface ScheduleRequirementGroup {
    name?: string | null;
    courseNames: string[];
    choose?: number;
}

export interface ScheduleGenerateRequirements {
    groups: ScheduleRequirementGroup[];
}

export interface ScheduleGenerateRequest {
    metadata: ScheduleGenerateMetadata;
    preferences: ScheduleGeneratePreferences;
    requirements: ScheduleGenerateRequirements;
    maxResults: number;
}

export interface GeneratedMeetingResponse {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export interface GeneratedSectionResponse {
    catalogSectionId: string;
    courseName: string;
    sectionCode: string;
    instructorName?: string | null;
    meetings: GeneratedMeetingResponse[];
}

export interface GeneratedScheduleResponse {
    resultId: string;
    totalInstructorScore?: number | null;
    numSections: number;
    meetsMon: boolean;
    meetsTue: boolean;
    meetsWed: boolean;
    meetsThu: boolean;
    meetsFri: boolean;
    meetsSat: boolean;
    earliestStart: string;
    latestEnd: string;
    sections: GeneratedSectionResponse[];
}

export interface ScheduleGenerateResponse {
    candidateCount: number;
    validCount: number;
    returnedCount: number;
    schedules: GeneratedScheduleResponse[];
}

export interface ScheduleLimitsResponse {
    maxCandidateCombinations: number;
    maxResults: number;
    maxCatalogCourses: number;
    maxCatalogSections: number;
    maxSectionsPerCourse: number;
    maxMeetingsPerSection: number;
    maxCatalogMeetings: number;
    maxSourceMetadataBytesPerSection: number;
    maxBlockedTimes: number;
    maxInstructorRatings: number;
}

export async function getSchedules({
    favoritesOnly = false,
    limit = 50,
    offset = 0,
    campusPatterns = null,
    times = null,
}: GetSchedulesOptions = {}) {
    const params = new URLSearchParams();
    if (favoritesOnly) {
        params.append("favorites_only", "true");
    }
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (campusPatterns && campusPatterns.length > 0) {
        campusPatterns.forEach((pattern) =>
            params.append("campusPatterns", pattern),
        );
    }

    if (times && times.length > 0) {
        times.forEach((time) => params.append("times", time));
    }

    return apiFetch(
        `/schedules?${params.toString()}`,
        "Failed to fetch schedules",
    );
}

export async function generateSchedules(
    payload: ScheduleGenerateRequest,
): Promise<ScheduleGenerateResponse> {
    return apiFetch("/schedules/generate", "Failed to generate schedules", {
        method: "POST",
        auth: true,
        json: payload,
    });
}

export async function getScheduleLimits(): Promise<ScheduleLimitsResponse> {
    return apiFetch("/schedules/limits", "Failed to fetch schedule limits");
}
