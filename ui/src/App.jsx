import { useState, useEffect } from "react";
import Card from "./components/card.jsx";
import {
	getSchedules,
	getFavorites,
	favoriteSchedule,
	unfavoriteSchedule,
} from "./api/client.js";
import "./App.css";

function App() {
	const [schedules, setSchedules] = useState([]);
	const [favorites, setFavorites] = useState(new Set());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function fetchData() {
			try {
				setLoading(true);
				const [schedulesData, favoritesData] = await Promise.all([
					getSchedules(),
					getFavorites(),
				]);
				setSchedules(schedulesData);
				setFavorites(new Set(favoritesData));
				setError(null);
			} catch (err) {
				setError(err.message);
				console.error("Failed to fetch data:", err);
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, []);

	const handleFavorite = async (scheduleId) => {
		const isFavorited = favorites.has(scheduleId);

		// Optimistic update
		setFavorites((prev) => {
			const newFavorites = new Set(prev);
			if (isFavorited) {
				newFavorites.delete(scheduleId);
			} else {
				newFavorites.add(scheduleId);
			}
			return newFavorites;
		});

		try {
			if (isFavorited) {
				await unfavoriteSchedule(scheduleId);
			} else {
				await favoriteSchedule(scheduleId);
			}
		} catch (err) {
			// Revert on error
			setFavorites((prev) => {
				const newFavorites = new Set(prev);
				if (isFavorited) {
					newFavorites.add(scheduleId);
				} else {
					newFavorites.delete(scheduleId);
				}
				return newFavorites;
			});
			console.error("Failed to toggle favorite:", err);
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
				<p className="text-xl">
					No schedules found. Run the schedule generator first!
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="sticky top-0 z-99 flex justify-center items-center bg-blue-600 h-12">
				<h1 className="text-2xl font-bold text-center">Schedules</h1>
			</div>
			<div className="p-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-10">
				{schedules.map((schedule) => (
					<Card
						key={schedule.schedule_id}
						{...schedule}
						isFavorited={favorites.has(schedule.schedule_id)}
						onFavorite={() => handleFavorite(schedule.schedule_id)}
					/>
				))}
			</div>
		</>
	);
}

export default App;
