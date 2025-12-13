import { useMemo, useState } from "react";

function Card(props) {
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
			<div className="absolute top-0 w-full h-9 bg-green-500 flex justify-center items-center text-center text-green-900 font-bold">
				Schedule #{props.schedule_id}
			</div>
			<p>{props.schedule_id}</p>
		</div>
	);
}

export default Card;
