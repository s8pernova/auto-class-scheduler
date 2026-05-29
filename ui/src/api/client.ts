/**
 * API client for the Schedule Planner backend.
 *
 * All requests target the versioned ``/api/v1`` namespace.
 */

import { supabase } from "@/clients/supabaseClient";

const BASE_URL = "/api/v1";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function formatApiErrorDetail(detail: unknown): string | null {
    if (typeof detail === "string") {
        return detail;
    }

    if (!Array.isArray(detail)) {
        return null;
    }

    const messages = detail
        .map((item) => {
            if (typeof item === "string") {
                return item;
            }
            if (!isRecord(item) || typeof item.msg !== "string") {
                return null;
            }

            const location = Array.isArray(item.loc)
                ? item.loc
                      .filter(
                          (part) =>
                              typeof part === "string" ||
                              typeof part === "number",
                      )
                      .join(".")
                : "";

            return location ? `${location}: ${item.msg}` : item.msg;
        })
        .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join("; ") : null;
}

async function buildApiErrorMessage(
    response: Response,
    fallback: string,
): Promise<string> {
    try {
        const body: unknown = await response.json();
        const detail = isRecord(body)
            ? formatApiErrorDetail(body.detail)
            : null;

        if (detail) {
            return `${fallback}: ${detail}`;
        }
    } catch {
        // Fall back to the status text below when the response is not JSON.
    }

    return `${fallback}: ${response.statusText}`;
}

async function buildAuthHeaders(): Promise<HeadersInit> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
}

async function buildJsonAuthHeaders(): Promise<HeadersInit> {
    return {
        "Content-Type": "application/json",
        ...(await buildAuthHeaders()),
    };
}

interface GetSchedulesOptions {
    favoritesOnly?: boolean;
    limit?: number;
    offset?: number;
    campuses?: string[] | null;
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

export interface ScheduleGenerateRequest {
    metadata: ScheduleGenerateMetadata;
    preferences: ScheduleGeneratePreferences;
    maxResults: number;
}

export interface GeneratedMeetingResponse {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export interface GeneratedSectionResponse {
    subjectCode: string;
    courseNumber: number;
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

/**
 * Fetch all schedules
 * @param {Object} options - Query options
 * @param {boolean} options.favoritesOnly - If true, only return favorited schedules
 * @param {number} options.limit - Maximum number of schedules to return
 * @param {number} options.offset - Number of schedules to skip
 * @param {Array<string>} options.campuses - Campus filters ('Annandale', 'Alexandria', 'Online')
 * @param {Array<string>} options.times - Time filters ('Morning', 'Afternoon', 'Evening')
 * @returns {Promise<Array>} List of schedule summaries
 */
export async function getSchedules({
    favoritesOnly = false,
    limit = 50,
    offset = 0,
    campuses = null,
    times = null,
}: GetSchedulesOptions = {}) {
    const params = new URLSearchParams();
    if (favoritesOnly) {
        params.append("favorites_only", "true");
    }
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    // Add campus filters
    if (campuses && campuses.length > 0) {
        campuses.forEach((campus) => params.append("campuses", campus));
    }

    // Add time filters
    if (times && times.length > 0) {
        times.forEach((time) => params.append("times", time));
    }

    const url = `${BASE_URL}/schedules?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch schedules: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Generate transient schedules from saved catalog candidate sections.
 */
export async function generateSchedules(
    payload: ScheduleGenerateRequest,
): Promise<ScheduleGenerateResponse> {
    const response = await fetch(`${BASE_URL}/schedules/generate`, {
        method: "POST",
        headers: await buildJsonAuthHeaders(),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(
            await buildApiErrorMessage(response, "Failed to generate schedules"),
        );
    }
    return response.json();
}

/**
 * Get all favorited schedule IDs
 * @returns {Promise<Array<number>>} List of favorited schedule IDs
 */
export async function getFavorites() {
    const response = await fetch(`${BASE_URL}/favorites`);
    if (!response.ok) {
        throw new Error(`Failed to fetch favorites: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Favorite a schedule
 * @param {number} scheduleId - The ID of the schedule to favorite
 * @returns {Promise<Object>} Favorite response
 */
export async function favoriteSchedule(scheduleId: number | string) {
    const response = await fetch(`${BASE_URL}/favorites/${scheduleId}`, {
        method: "POST",
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }
        throw new Error(`Failed to favorite schedule: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Unfavorite a schedule
 * @param {number} scheduleId - The ID of the schedule to unfavorite
 * @returns {Promise<Object>} Unfavorite response
 */
export async function unfavoriteSchedule(scheduleId: number | string) {
    const response = await fetch(`${BASE_URL}/favorites/${scheduleId}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Schedule ${scheduleId} is not favorited`);
        }
        throw new Error(
            `Failed to unfavorite schedule: ${response.statusText}`,
        );
    }
    return response.json();
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
        throw new Error("Health check failed");
    }
    return response.json();
}

// Catalogs

interface CreateCatalogPayload {
    name: string;
    description?: string | null;
    source_type?: string;
    school_name?: string | null;
    term_name?: string | null;
}

export interface CatalogResponse {
    id: string;
    name: string;
    description: string | null;
    source_type: string;
    school_name: string | null;
    term_name: string | null;
    status: string;
    row_count: number;
    source_metadata: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    last_imported_at: string | null;
}

export interface CatalogSectionMeetingInput {
    days: string;
    startTime: string;
    endTime: string;
    sortOrder?: number;
}

export interface CatalogSectionInput {
    subjectCode: string;
    courseNumber: number;
    sectionCode?: string | null;
    crn?: string | null;
    instructorName?: string | null;
    sortOrder?: number;
    sourceMetadata?: Record<string, unknown>;
    meetings: CatalogSectionMeetingInput[];
}

export interface CatalogSectionsReplaceRequest {
    sections: CatalogSectionInput[];
}

export interface CatalogSectionMeetingResponse {
    id: string;
    sectionId: string;
    days: string;
    startTime: string;
    endTime: string;
    sortOrder: number;
}

export interface CatalogSectionResponse {
    id: string;
    catalogId: string;
    subjectCode: string;
    courseNumber: number;
    sectionCode: string | null;
    crn: string | null;
    instructorName: string | null;
    sortOrder: number;
    sourceMetadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    meetings: CatalogSectionMeetingResponse[];
}

/**
 * Create a new catalog.
 */
export async function createCatalog(
    payload: CreateCatalogPayload,
): Promise<CatalogResponse> {
    const response = await fetch(`${BASE_URL}/catalogs`, {
        method: "POST",
        headers: await buildJsonAuthHeaders(),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(
            await buildApiErrorMessage(response, "Failed to create catalog"),
        );
    }
    return response.json();
}

/**
 * Fetch a catalog by ID.
 */
export async function getCatalog(catalogId: string): Promise<CatalogResponse> {
    const response = await fetch(
        `${BASE_URL}/catalogs/${encodeURIComponent(catalogId)}`,
        {
            headers: await buildAuthHeaders(),
        },
    );
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Catalog not found");
        }
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Fetch normalized sections for a catalog.
 */
export async function getCatalogSections(
    catalogId: string,
): Promise<CatalogSectionResponse[]> {
    const response = await fetch(
        `${BASE_URL}/catalogs/${encodeURIComponent(catalogId)}/sections`,
        {
            headers: await buildAuthHeaders(),
        },
    );
    if (!response.ok) {
        throw new Error(
            await buildApiErrorMessage(response, "Failed to fetch catalog sections"),
        );
    }
    return response.json();
}

/**
 * Replace a catalog's normalized candidate sections.
 */
export async function replaceCatalogSections(
    catalogId: string,
    payload: CatalogSectionsReplaceRequest,
): Promise<CatalogSectionResponse[]> {
    const response = await fetch(
        `${BASE_URL}/catalogs/${encodeURIComponent(catalogId)}/sections`,
        {
            method: "PUT",
            headers: await buildJsonAuthHeaders(),
            body: JSON.stringify(payload),
        },
    );
    if (!response.ok) {
        throw new Error(
            await buildApiErrorMessage(response, "Failed to save catalog sections"),
        );
    }
    return response.json();
}
