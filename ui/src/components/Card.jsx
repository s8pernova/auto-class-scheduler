import { useMemo, useState } from "react";
import { FaStar, FaRegStar } from "react-icons/fa";
import SectionCard from "./SectionCard.jsx";

const formatTime = (timeStr) => {
	// Convert "HH:MM:SS" to "HH:MM AM/PM"
	const [hours, minutes] = timeStr.split(":");
	const hour = parseInt(hours);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${minutes} ${ampm}`;
};

function Card({
	schedule_id,
	sections,
	total_credits,
	total_instructor_score,
	earliest_start,
	latest_end,
	campus_pattern,
	isFavorited,
	onFavorite,
}) {
	const rotation = useMemo(() => {
		const values = [-2, -1, 1, 2];
		return values[Math.floor(Math.random() * values.length)];
	}, []);
	const [hovered, setHovered] = useState(false);
	const transform = hovered ? `rotate(${rotation}deg) scale(1.03)` : "";

	const handleFavoriteClick = (e) => {
		e.stopPropagation();
		onFavorite();
	};

	return (
		<div
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{ transform }}
			className="relative bg-[#182246] h-auto rounded-[3em] text-left flex flex-col hover:shadow-[0_0_0_5px_#fff] transition-all duration-250 ease-in-out overflow-hidden"
		>
			<div className="h-9 bg-green-500 flex justify-center items-center text-center text-green-900 font-bold gap-2 z-10">
				<h2>Schedule #{schedule_id}</h2>
				<button
					onClick={handleFavoriteClick}
					className="cursor-pointer hover:scale-120 transition duration-250 ease-in-out"
					aria-label={isFavorited ? "Unfavorite schedule" : "Favorite schedule"}
				>
					{isFavorited ? (
						<FaStar className="transition duration-250 ease-in-out text-yellow-400" />
					) : (
						<FaRegStar className="transition duration-250 ease-in-out hover:text-yellow-400" />
					)}
				</button>
			</div>

			<div className="p-3 overflow-y-auto h-100 space-y-3">
				<div className="px-4 text-sm text-gray-300">
					<p>
						Credits: {total_credits} | Avg. Rating:{" "}
						{total_instructor_score?.toFixed(1) || "N/A"}
					</p>
					<p>
						Time: {formatTime(earliest_start)} - {formatTime(latest_end)}
					</p>
					<p>Campus: {campus_pattern}</p>
				</div>

				<div className="space-y-3">
					{sections.map((section, idx) => (
						<SectionCard
							key={`${section.subject_code}-${section.course_number}-${section.section_code}-${idx}`}
							section={section}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export default Card;
