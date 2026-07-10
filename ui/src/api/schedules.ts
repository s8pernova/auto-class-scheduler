import {
    createGenerationSessionApiV1ScheduleGenerationSessionsPost,
    getScheduleLimitsApiV1SchedulesLimitsGet,
    getSchedulesApiV1SchedulesGet,
    queryGenerationSessionResultsApiV1ScheduleGenerationSessionsSessionIdResultsPost,
} from "@/api/generated";
import type {
    GetScheduleLimitsApiV1SchedulesLimitsGetResponse,
    GetSchedulesApiV1SchedulesGetResponse,
    GeneratedMeetingResponse as ApiGeneratedMeetingResponse,
    GeneratedScheduleResponse as ApiGeneratedScheduleResponse,
    GeneratedSectionResponse as ApiGeneratedSectionResponse,
    ScheduleGenerationSessionResponse as ApiScheduleGenerationSessionResponse,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateMetadata,
    ScheduleGenerateRequirements,
    ScheduleGenerationSessionCreateRequest,
    ScheduleGenerationSessionFilters,
    ScheduleGenerationSessionQueryRequest,
    ScheduleGenerationSessionSort,
    ScheduleLimitsResponse,
    ScheduleRequirementGroup,
} from "@/api/generated";
import {
    getAccessToken,
    getRequiredAccessToken,
    unwrapApiResult,
} from "@/api/http";

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
    ScheduleGenerateRequirements,
    ScheduleGenerationSessionCreateRequest,
    ScheduleGenerationSessionFilters,
    ScheduleGenerationSessionQueryRequest,
    ScheduleGenerationSessionSort,
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

export type ScheduleGenerationSessionResponse = Omit<
    ApiScheduleGenerationSessionResponse,
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

function normalizeGenerationSessionResponse(
    response: ApiScheduleGenerationSessionResponse,
): ScheduleGenerationSessionResponse {
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

export async function createGenerationSession(
    payload: ScheduleGenerationSessionCreateRequest,
): Promise<ScheduleGenerationSessionResponse> {
    const response = await unwrapApiResult(
        await createGenerationSessionApiV1ScheduleGenerationSessionsPost({
            auth: getRequiredAccessToken,
            body: payload,
        }),
        "Failed to generate schedules",
    );
    return normalizeGenerationSessionResponse(response);
}

export async function queryGenerationSessionResults(
    sessionId: string,
    payload: ScheduleGenerationSessionQueryRequest,
): Promise<ScheduleGenerationSessionResponse> {
    const response = await unwrapApiResult(
        await queryGenerationSessionResultsApiV1ScheduleGenerationSessionsSessionIdResultsPost(
            {
                auth: getRequiredAccessToken,
                body: payload,
                path: {
                    session_id: sessionId,
                },
            },
        ),
        "Failed to query generated schedules",
    );
    return normalizeGenerationSessionResponse(response);
}

export async function getScheduleLimits(): Promise<GetScheduleLimitsApiV1SchedulesLimitsGetResponse> {
    return unwrapApiResult(
        await getScheduleLimitsApiV1SchedulesLimitsGet(),
        "Failed to fetch schedule limits",
    );
}
