import { useMemo, useState } from "react";
import { FaStar, FaRegStar } from "react-icons/fa";

function Card({ schedule_id, isFavorited, onFavorite }) {
	const rotation = useMemo(() => {
		const values = [-2, -1, 1, 2];
		return values[Math.floor(Math.random() * values.length)];
	}, []);
	const [hovered, setHovered] = useState(false);
	const transform = hovered ? `rotate(${rotation}deg) scale(1.03)` : "";

	return (
		<div
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{ transform }}
			className="relative bg-[#182246] h-90 rounded-[3em] text-center flex items-center justify-center hover:shadow-[0_0_0_5px_#fff] transition duration-250 ease-in-out overflow-hidden"
		>
			<div className="absolute top-0 w-full h-9 bg-green-500 flex justify-center items-center text-center text-green-900 font-bold gap-2">
				<h2>Schedule #{schedule_id}</h2>
				<button
					onClick={onFavorite}
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
			<p>{schedule_id}</p>
		</div>
	);
}

export default Card;
