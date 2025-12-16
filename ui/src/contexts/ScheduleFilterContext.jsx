import { createContext, useContext, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const ScheduleFilterContext = createContext(null);

export function ScheduleFilterProvider({ children }) {
	const [searchParams, setSearchParams] = useSearchParams();

	// Initialize URL params on first load if they don't exist
	useEffect(() => {
		const campuses = searchParams.getAll('campuses');
		const times = searchParams.getAll('times');

		if (campuses.length === 0 || times.length === 0) {
			const newParams = new URLSearchParams(searchParams);

			if (campuses.length === 0) {
				['Annandale', 'Alexandria', 'Online'].forEach(c => newParams.append('campuses', c));
			}

			if (times.length === 0) {
				['Morning', 'Afternoon', 'Evening'].forEach(t => newParams.append('times', t));
			}

			setSearchParams(newParams, { replace: true });
		}
	}, []);

	// Read filters from URL, or use defaults
	const selectedCampuses = useMemo(() => {
		const campuses = searchParams.getAll('campuses');
		return campuses.length > 0 ? campuses : ['Annandale', 'Alexandria', 'Online'];
	}, [searchParams]);

	const selectedTimes = useMemo(() => {
		const times = searchParams.getAll('times');
		return times.length > 0 ? times : ['Morning', 'Afternoon', 'Evening'];
	}, [searchParams]);

	// Functions to update URL when filters change
	const handleCampusChange = (newCampuses) => {
		const newParams = new URLSearchParams(searchParams);
		newParams.delete('campuses');
		newCampuses.forEach(c => newParams.append('campuses', c));
		setSearchParams(newParams);
	};

	const handleTimeChange = (newTimes) => {
		const newParams = new URLSearchParams(searchParams);
		newParams.delete('times');
		newTimes.forEach(t => newParams.append('times', t));
		setSearchParams(newParams);
	};

	return (
		<ScheduleFilterContext.Provider value={{
			selectedCampuses,
			selectedTimes,
			handleCampusChange,
			handleTimeChange
		}}>
			{children}
		</ScheduleFilterContext.Provider>
	);
}

export function useScheduleFilters() {
	const context = useContext(ScheduleFilterContext);
	if (!context) {
		throw new Error('useScheduleFilters must be used within a ScheduleFilterProvider');
	}
	return context;
}
