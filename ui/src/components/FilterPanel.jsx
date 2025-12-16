export default function FilterPanel({
	selectedCampuses,
	onCampusChange,
	selectedTimes,
	onTimeChange
}) {
	const campusOptions = ['Annandale', 'Alexandria', 'Online'];
	const timeOptions = ['Morning', 'Afternoon', 'Evening'];

	const toggleCampus = (campus) => {
		if (selectedCampuses.includes(campus)) {
			onCampusChange(selectedCampuses.filter(c => c !== campus));
		} else {
			onCampusChange([...selectedCampuses, campus]);
		}
	};

	const toggleTime = (time) => {
		if (selectedTimes.includes(time)) {
			onTimeChange(selectedTimes.filter(t => t !== time));
		} else {
			onTimeChange([...selectedTimes, time]);
		}
	};

	return (
		<div className="bg-gray-800 px-20 py-4 space-y-3">
			<div className="flex items-center gap-4">
				<span className="text-white font-semibold">Location:</span>
				{campusOptions.map(campus => (
					<label key={campus} className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={selectedCampuses.includes(campus)}
							onChange={() => toggleCampus(campus)}
							className="w-4 h-4"
						/>
						<span className="text-white">{campus}</span>
					</label>
				))}
			</div>
			<div className="flex items-center gap-4">
				<span className="text-white font-semibold">Time:</span>
				{timeOptions.map(time => (
					<label key={time} className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={selectedTimes.includes(time)}
							onChange={() => toggleTime(time)}
							className="w-4 h-4"
						/>
						<span className="text-white">{time}</span>
					</label>
				))}
			</div>
		</div>
	);
}
