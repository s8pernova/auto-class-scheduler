import { createContext, useContext, useState, ReactNode } from 'react';

interface FilterContextType {
	showOnlyFavorites: boolean;
	setShowOnlyFavorites: (show: boolean) => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
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
