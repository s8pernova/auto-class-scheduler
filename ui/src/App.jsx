import { useState, useEffect, useRef } from "react";
import Card from "./components/Card.jsx";
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
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState(null);
	const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const isLoadingRef = useRef(false);
	const ITEMS_PER_PAGE = 50;

	// Initial load
	useEffect(() => {
		async function fetchData() {
			try {
				setLoading(true);
				const [schedulesData, favoritesData] = await Promise.all([
					getSchedules({
						favoritesOnly: showOnlyFavorites,
						limit: ITEMS_PER_PAGE,
						offset: 0,
					}),
					getFavorites(),
				]);
				setSchedules(schedulesData);
				setFavorites(new Set(favoritesData));
				setHasMore(schedulesData.length === ITEMS_PER_PAGE);
				setError(null);
			} catch (err) {
				setError(err.message);
				console.error("Failed to fetch data:", err);
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, [showOnlyFavorites]);

	// Infinite scroll - load more when scrolling
	useEffect(() => {
		const handleScroll = () => {
			// Check if user scrolled near bottom (within 500px)
			const scrolledToBottom =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 500;

			if (scrolledToBottom && !loadingMore && hasMore) {
				loadMore();
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [loadingMore, hasMore, schedules.length, showOnlyFavorites]);

	const loadMore = async () => {
		if (loadingMore || !hasMore || isLoadingRef.current) return;

		try {
			isLoadingRef.current = true;
			setLoadingMore(true);
			const currentOffset = schedules.length;
			const moreSchedules = await getSchedules({
				favoritesOnly: showOnlyFavorites,
				limit: ITEMS_PER_PAGE,
				offset: currentOffset,
			});

			// Filter out any duplicates based on schedule_id
			setSchedules((prev) => {
				const existingIds = new Set(prev.map((s) => s.schedule_id));
				const newSchedules = moreSchedules.filter(
					(s) => !existingIds.has(s.schedule_id)
				);
				return [...prev, ...newSchedules];
			});
			setHasMore(moreSchedules.length === ITEMS_PER_PAGE);
		} catch (err) {
			console.error("Failed to load more schedules:", err);
		} finally {
			setLoadingMore(false);
			isLoadingRef.current = false;
		}
	};

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
					className="px-5 py-2 bg-blue-500 text-white rounded-full font-semibold cursor-pointer"
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
			<div className="sticky top-0 z-99 flex justify-between items-center bg-gray-800 h-12 px-20">
				<h1 className="text-2xl font-bold">Possible Schedules</h1>
				<button
					onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
					className={`px-4 py-2 rounded-full font-semibold transition cursor-pointer ${
						showOnlyFavorites
							? "bg-yellow-400 text-blue-900"
							: "bg-gray-700 text-white hover:bg-gray-600"
					}`}
				>
					{showOnlyFavorites ? "Show All" : "Show Favorites"}
				</button>
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
			{loadingMore && (
				<div className="flex justify-center pb-10">
					<p className="text-lg font-semibold text-gray-600">
						Loading more schedules...
					</p>
				</div>
			)}
			{!hasMore && schedules.length > 0 && (
				<div className="flex justify-center pb-10">
					<p className="text-lg font-semibold text-gray-500">
						End of schedules
					</p>
				</div>
			)}
		</>
	);
}

export default App;
