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
 * Favorite a schedule
 * @param {number} scheduleId - The ID of the schedule to favorite
 * @returns {Promise<Object>} Favorite response
 */
export async function favoriteSchedule(scheduleId) {
	const response = await fetch(`${BASE_URL}/favorite`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ schedule_id: scheduleId }),
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
