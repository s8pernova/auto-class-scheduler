/**
 * API client for the Schedule Planner backend.
 *
 * All requests target the versioned ``/api/v1`` namespace.
 */

const BASE_URL = "/api/v1";

interface GetSchedulesOptions {
    favoritesOnly?: boolean;
    limit?: number;
    offset?: number;
    campuses?: string[] | null;
    times?: string[] | null;
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
        throw new Error(`Failed to unfavorite schedule: ${response.statusText}`);
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
    const response = await fetch(`${BASE_URL}/catalogs/${encodeURIComponent(catalogId)}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Catalog not found");
        }
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
    }
    return response.json();
}
