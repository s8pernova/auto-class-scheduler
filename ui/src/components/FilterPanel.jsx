import { useScheduleFilters } from "../contexts/ScheduleFilterContext";
import { CheckboxUnselected, CheckboxSelected } from "./Checkboxes";

export default function FilterPanel() {
	const {
		selectedCampuses,
		selectedTimes,
		handleCampusChange,
		handleTimeChange,
	} = useScheduleFilters();
	const campusOptions = ["Annandale", "Alexandria", "Online"];
	const timeOptions = ["Morning", "Afternoon", "Evening"];

	const toggleCampus = (campus) => {
		if (selectedCampuses.includes(campus)) {
			handleCampusChange(selectedCampuses.filter((c) => c !== campus));
		} else {
			handleCampusChange([...selectedCampuses, campus]);
		}
	};

	const toggleTime = (time) => {
		if (selectedTimes.includes(time)) {
			handleTimeChange(selectedTimes.filter((t) => t !== time));
		} else {
			handleTimeChange([...selectedTimes, time]);
		}
	};

	return (
		<div className="flex justify-center items-center text-center gap-10 select-none">
			<div className="flex items-center gap-4">
				<span className="text-white font-semibold">Location:</span>
				{campusOptions.map((campus) => (
					<label
						key={campus}
						className="flex items-center gap-2 cursor-pointer"
					>
						<span onClick={() => toggleCampus(campus)}>
							{selectedCampuses.includes(campus) ? (
								<CheckboxSelected />
							) : (
								<CheckboxUnselected />
							)}
						</span>
						<span className="text-white">{campus}</span>
					</label>
				))}
			</div>
			<p>|</p>
			<div className="flex items-center gap-4">
				<span className="text-white font-semibold">Time:</span>
				{timeOptions.map((time) => (
					<label key={time} className="flex items-center gap-2 cursor-pointer">
						<span onClick={() => toggleTime(time)}>
							{selectedTimes.includes(time) ? (
								<CheckboxSelected />
							) : (
								<CheckboxUnselected />
							)}
						</span>
						<span className="text-white">{time}</span>
					</label>
				))}
			</div>
		</div>
	);
}
