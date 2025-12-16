import { RiCalendarScheduleLine } from "react-icons/ri";
import { useFilters } from "../contexts/FavoritesContext";
import { Link } from "react-router-dom";
import FilterPanel from "./FilterPanel";

export default function Navbar() {
	const { showOnlyFavorites, setShowOnlyFavorites } = useFilters();

	return (
		<div className="sticky top-0 z-99 bg-gray-800/90">
			<div className="flex justify-between items-center h-12 px-20">
				<div className="flex justify-center items-center gap-3">
					<Link to="/" className="text-2xl font-bold">
						Possible Schedules
					</Link>
					<RiCalendarScheduleLine className="w-6 h-6 rotate-15" />
				</div>
				<FilterPanel />
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
		</div>
	);
}
