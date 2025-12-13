import { useState, useEffect } from "react";
import Card from "./components/card.jsx";
import { getSchedules, favoriteSchedule } from "./api/client.js";
import "./App.css";

function App() {
	const [schedules, setSchedules] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function fetchSchedules() {
			try {
				setLoading(true);
				const data = await getSchedules();
				setSchedules(data);
				setError(null);
			} catch (err) {
				setError(err.message);
				console.error("Failed to fetch schedules:", err);
			} finally {
				setLoading(false);
			}
		}

		fetchSchedules();
	}, []);

	const handleFavorite = async (scheduleId) => {
		try {
			await favoriteSchedule(scheduleId);
			console.log(`Favorited schedule ${scheduleId}`);
			// Optionally refetch schedules or update UI
		} catch (err) {
			console.error("Failed to favorite schedule:", err);
			alert(`Error: ${err.message}`);
		}
	};

	if (loading) {
		return (
			<div className="p-10 text-center">
				<p className="text-xl">Loading schedules...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-10 text-center">
				<p className="text-xl text-red-500">Error: {error}</p>
				<button
					onClick={() => window.location.reload()}
					className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
				>
					Retry
				</button>
			</div>
		);
	}

	if (schedules.length === 0) {
		return (
			<div className="p-10 text-center">
				<p className="text-xl">No schedules found. Run the schedule generator first!</p>
			</div>
		);
	}

	return (
		<div className="p-10 grid grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-10">
			{schedules.map((schedule) => (
				<Card
					key={schedule.schedule_id}
					{...schedule}
					onFavorite={() => handleFavorite(schedule.schedule_id)}
				/>
			))}
		</div>
	);
}

export default App;
