import { createContext, useContext, useState } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
	const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

	return (
		<FilterContext.Provider value={{ showOnlyFavorites, setShowOnlyFavorites }}>
			{children}
		</FilterContext.Provider>
	);
}

export function useFilters() {
	const context = useContext(FilterContext);
	if (!context) {
		throw new Error('useFilters must be used within a FilterProvider');
	}
	return context;
}
