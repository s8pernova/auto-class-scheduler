import type {
    ScheduleGenerationSessionFilters,
    ScheduleGenerationSessionQueryRequest,
    ScheduleGenerationSessionResponse,
    ScheduleGenerationSessionSort,
} from "@/api";
import { ApiError } from "@/api/errors";

export interface GenerationViewState {
    filters: ScheduleGenerationSessionFilters;
    sort: ScheduleGenerationSessionSort;
    pageLimit: number;
}

export interface GenerationBlockedTimeState {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export function toGenerationBlockedTimes(
    blockedTimes: GenerationBlockedTimeState[],
) {
    return blockedTimes.map((blockedTime) => ({
        days: blockedTime.dayOfWeek,
        startTime: blockedTime.startTime,
        endTime: blockedTime.endTime,
    }));
}

export function buildDefaultGenerationView(
    blockedTimes: GenerationBlockedTimeState[] = [],
): GenerationViewState {
    return {
        filters: {
            allowUnratedInstructors: true,
            blockedTimes: toGenerationBlockedTimes(blockedTimes),
            excludedDays: [],
            maxMeetingDays: null,
            maxSingleGapMinutes: null,
            maxTotalGapMinutes: null,
            minimumInstructorRating: null,
            notAfter: null,
            notBefore: null,
        },
        sort: {
            direction: "asc",
            field: "earliestStart",
        },
        pageLimit: 50,
    };
}

export function withGenerationBlockedTimes(
    view: GenerationViewState,
    blockedTimes: GenerationBlockedTimeState[],
): GenerationViewState {
    return {
        ...view,
        filters: {
            ...view.filters,
            blockedTimes: toGenerationBlockedTimes(blockedTimes),
        },
    };
}

export function buildGenerationSessionQueryRequest(
    view: GenerationViewState,
    cursor: string | null,
): ScheduleGenerationSessionQueryRequest {
    return {
        filters: view.filters,
        sort: view.sort,
        page: {
            cursor,
            limit: view.pageLimit,
        },
    };
}

export function mergeGenerationSessionPages(
    current: ScheduleGenerationSessionResponse,
    next: ScheduleGenerationSessionResponse,
): ScheduleGenerationSessionResponse {
    if (current.sessionId !== next.sessionId) {
        throw new Error("Cannot merge pages from different generation sessions");
    }

    const schedules = [...current.schedules, ...next.schedules];
    return {
        ...next,
        returnedCount: schedules.length,
        schedules,
    };
}

export function isGenerationSessionExpiredError(err: unknown): boolean {
    return (
        err instanceof ApiError &&
        (err.status === 410 || err.code === "generation_session_expired")
    );
}

export function getGenerationSessionErrorMessage(
    err: unknown,
    fallback: string,
): string {
    if (isGenerationSessionExpiredError(err)) {
        return "This temporary generation session expired. Regenerate it to continue.";
    }
    return err instanceof Error ? err.message : fallback;
}
