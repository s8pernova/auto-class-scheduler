/**
 * API client for the Schedule Planner backend
 */

const BASE_URL = '/api';

/**
 * Fetch all schedules
 * @param {Object} options - Query options
 * @param {boolean} options.favoritesOnly - If true, only return favorited schedules
 * @param {number} options.limit - Maximum number of schedules to return
 * @param {number} options.offset - Number of schedules to skip
 * @returns {Promise<Array>} List of schedule summaries
 */
export async function getSchedules(options = {}) {
	const { favoritesOnly = false, limit = 50, offset = 0 } = options;
	const params = new URLSearchParams();
	if (favoritesOnly) {
		params.append('favorites_only', 'true');
	}
	params.append('limit', limit.toString());
	params.append('offset', offset.toString());

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
export async function favoriteSchedule(scheduleId) {
	const response = await fetch(`${BASE_URL}/favorite/${scheduleId}`, {
		method: 'POST',
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
export async function unfavoriteSchedule(scheduleId) {
	const response = await fetch(`${BASE_URL}/favorite/${scheduleId}`, {
		method: 'DELETE',
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
		throw new Error('Health check failed');
	}
	return response.json();
}
