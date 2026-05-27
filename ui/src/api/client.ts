/**
 * API client for the Schedule Planner backend.
 *
 * All requests target the versioned ``/api/v1`` namespace.
 */

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

interface GetSchedulesOptions {
    favoritesOnly?: boolean;
    limit?: number;
    offset?: number;
    campuses?: string[] | null;
    times?: string[] | null;
}

export interface ScheduleGenerateMetadata {
    catalogId?: string;
    name?: string;
    schoolName?: string;
    termName?: string;
}

export interface ScheduleGenerateMeetingInput {
    days: string;
    startTime: string;
    endTime: string;
}

export interface ScheduleGenerateSectionInput {
    sectionCode?: string;
    crn?: string;
    instructorName?: string;
    instructorRating?: number | null;
    campus?: string;
    modality?: string;
    credits?: number;
    meetings: ScheduleGenerateMeetingInput[];
}

export interface ScheduleGenerateCourseInput {
    subjectCode: string;
    courseNumber: number;
    courseTitle?: string;
    sections: ScheduleGenerateSectionInput[];
}

export interface ScheduleGenerateBlockedTimeInput {
    days: string;
    startTime: string;
    endTime: string;
}

export interface ScheduleGeneratePreferences {
    blockedTimes: ScheduleGenerateBlockedTimeInput[];
    allowCampusSwitch: boolean;
    allowFullSections?: boolean;
    allowRestrictedSections?: boolean;
    campuses: string[];
    times: string[];
}

export interface ScheduleGenerateRequest {
    metadata: ScheduleGenerateMetadata;
    courses: ScheduleGenerateCourseInput[];
    preferences: ScheduleGeneratePreferences;
    maxResults: number;
}

export interface GeneratedMeetingResponse {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    campus: string;
}

export interface GeneratedSectionResponse {
    subjectCode: string;
    courseNumber: number;
    sectionCode: string;
    courseTitle: string;
    credits: number;
    modality?: string | null;
    instructorName?: string | null;
    meetings: GeneratedMeetingResponse[];
}

export interface GeneratedScheduleResponse {
    resultId: string;
    totalCredits: number;
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
    campusPattern: string;
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
 * Generate transient schedules from BYOC candidate sections.
 */
export async function generateSchedules(
    payload: ScheduleGenerateRequest,
): Promise<ScheduleGenerateResponse> {
    const response = await fetch(`${BASE_URL}/schedules/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

/**
 * Create a new catalog.
 */
export async function createCatalog(
    payload: CreateCatalogPayload,
): Promise<CatalogResponse> {
    const response = await fetch(`${BASE_URL}/catalogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Failed to create catalog: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Fetch a catalog by ID.
 */
export async function getCatalog(catalogId: string): Promise<CatalogResponse> {
    const response = await fetch(
        `${BASE_URL}/catalogs/${encodeURIComponent(catalogId)}`,
    );
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Catalog not found");
        }
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
    }
    return response.json();
}
