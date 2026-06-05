import {
    generateSchedulesApiV1SchedulesGeneratePost,
    getScheduleLimitsApiV1SchedulesLimitsGet,
    getSchedulesApiV1SchedulesGet,
} from "@/api/generated";
import type {
    GenerateSchedulesApiV1SchedulesGeneratePostResponse,
    GetScheduleLimitsApiV1SchedulesLimitsGetResponse,
    GetSchedulesApiV1SchedulesGetResponse,
    GeneratedMeetingResponse as ApiGeneratedMeetingResponse,
    GeneratedScheduleResponse as ApiGeneratedScheduleResponse,
    GeneratedSectionResponse as ApiGeneratedSectionResponse,
    ScheduleGenerateResponse as ApiScheduleGenerateResponse,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateMetadata,
    ScheduleGeneratePreferences,
    ScheduleGenerateRequest,
    ScheduleGenerateRequirements,
    ScheduleLimitsResponse,
    ScheduleRequirementGroup,
} from "@/api/generated";
import { getAccessToken, unwrapApiResult } from "@/api/http";

interface GetSchedulesOptions {
    favoritesOnly?: boolean;
    limit?: number;
    offset?: number;
    campusPatterns?: string[] | null;
    times?: string[] | null;
}

export type {
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateMetadata,
    ScheduleGeneratePreferences,
    ScheduleGenerateRequest,
    ScheduleGenerateRequirements,
    ScheduleLimitsResponse,
    ScheduleRequirementGroup,
};

export type GeneratedMeetingResponse = ApiGeneratedMeetingResponse;

export type GeneratedSectionResponse = Omit<
    ApiGeneratedSectionResponse,
    "meetings"
> & {
    meetings: GeneratedMeetingResponse[];
};

export type GeneratedScheduleResponse = Omit<
    ApiGeneratedScheduleResponse,
    "sections"
> & {
    sections: GeneratedSectionResponse[];
};

export type ScheduleGenerateResponse = Omit<
    ApiScheduleGenerateResponse,
    "schedules"
> & {
    schedules: GeneratedScheduleResponse[];
};

function normalizeGeneratedSection(
    section: ApiGeneratedSectionResponse,
): GeneratedSectionResponse {
    return {
        ...section,
        meetings: section.meetings ?? [],
    };
}

function normalizeGeneratedSchedule(
    schedule: ApiGeneratedScheduleResponse,
): GeneratedScheduleResponse {
    return {
        ...schedule,
        sections: (schedule.sections ?? []).map(normalizeGeneratedSection),
    };
}

function normalizeScheduleGenerateResponse(
    response: GenerateSchedulesApiV1SchedulesGeneratePostResponse,
): ScheduleGenerateResponse {
    return {
        ...response,
        schedules: (response.schedules ?? []).map(normalizeGeneratedSchedule),
    };
}

export async function getSchedules({
    favoritesOnly = false,
    limit = 50,
    offset = 0,
    campusPatterns = null,
    times = null,
}: GetSchedulesOptions = {}): Promise<GetSchedulesApiV1SchedulesGetResponse> {
    return unwrapApiResult(
        await getSchedulesApiV1SchedulesGet({
            auth: getAccessToken,
            query: {
                campusPatterns,
                favorites_only: favoritesOnly,
                limit,
                offset,
                times,
            },
        }),
        "Failed to fetch schedules",
    );
}

export async function generateSchedules(
    payload: ScheduleGenerateRequest,
): Promise<ScheduleGenerateResponse> {
    const response = await unwrapApiResult(
        await generateSchedulesApiV1SchedulesGeneratePost({
            auth: getAccessToken,
            body: payload,
        }),
        "Failed to generate schedules",
    );
    return normalizeScheduleGenerateResponse(response);
}

export async function getScheduleLimits(): Promise<GetScheduleLimitsApiV1SchedulesLimitsGetResponse> {
    return unwrapApiResult(
        await getScheduleLimitsApiV1SchedulesLimitsGet(),
        "Failed to fetch schedule limits",
    );
}
