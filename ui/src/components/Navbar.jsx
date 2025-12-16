import { useFilters } from "../contexts/FavoritesContext";
import FilterPanel from "./FilterPanel";

export default function Navbar() {
	const { showOnlyFavorites, setShowOnlyFavorites } = useFilters();

	return (
		<div className="sticky top-0 z-99 bg-gray-800">
			<div className="flex justify-between items-center h-12 px-20">
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
			<FilterPanel />
		</div>
	);
}
