import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

interface ScheduleFilterContextType {
    selectedCampuses: string[];
    selectedTimes: string[];
    handleCampusChange: (newCampuses: string[]) => void;
    handleTimeChange: (newTimes: string[]) => void;
}

const ScheduleFilterContext = createContext<ScheduleFilterContextType | null>(null);

export function ScheduleFilterProvider({ children }: { children: ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();

    // Read filters from URL, or use defaults
    const selectedCampuses = useMemo(() => {
        return searchParams.getAll('campuses');
    }, [searchParams]);

    const selectedTimes = useMemo(() => {
        return searchParams.getAll('times');
    }, [searchParams]);

    // Functions to update URL when filters change
    const handleCampusChange = (newCampuses: string[]) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('campuses');
        newCampuses.forEach(c => newParams.append('campuses', c));
        setSearchParams(newParams);
    };

    const handleTimeChange = (newTimes: string[]) => {
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
