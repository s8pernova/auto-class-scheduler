import { AiOutlineLoading3Quarters } from "react-icons/ai";

export default function Loading() {
	return (
		<div className="flex gap-4 justify-center items-center min-h-screen text-lg font-semibold text-gray-600">
			<AiOutlineLoading3Quarters className="animate-spin" />
			<p>Loading schedules...</p>
		</div>
	);
}
