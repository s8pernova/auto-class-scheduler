/**
 * API client for the Schedule Planner backend
 */

const BASE_URL = '/api';

/**
 * Fetch all schedules
 * @returns {Promise<Array>} List of schedule summaries
 */
export async function getSchedules() {
	const response = await fetch(`${BASE_URL}/schedules`);
	if (!response.ok) {
		throw new Error(`Failed to fetch schedules: ${response.statusText}`);
	}
	return response.json();
}

/**
 * Fetch a specific schedule by ID
 * @param {number} scheduleId - The ID of the schedule
 * @returns {Promise<Object>} Schedule detail with sections
 */
export async function getSchedule(scheduleId) {
	const response = await fetch(`${BASE_URL}/schedules/${scheduleId}`);
	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(`Schedule ${scheduleId} not found`);
		}
		throw new Error(`Failed to fetch schedule: ${response.statusText}`);
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
