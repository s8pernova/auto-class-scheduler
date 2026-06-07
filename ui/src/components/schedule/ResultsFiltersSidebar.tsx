import {
    DAY_FILTERS,
    SORT_OPTIONS,
    type DayFilter,
    type SortKey,
} from "@/utils/scheduleResults";

type ResultsFiltersSidebarProps = {
    sortKey: SortKey;
    dayFilter: DayFilter;
    validCount: number;
    visibleCount: number;
    onSortKeyChange: (sortKey: SortKey) => void;
    onDayFilterChange: (dayFilter: DayFilter) => void;
};

export default function ResultsFiltersSidebar({
    sortKey,
    dayFilter,
    validCount,
    visibleCount,
    onSortKeyChange,
    onDayFilterChange,
}: ResultsFiltersSidebarProps) {
    return (
        <aside className="bg-surface rounded-[10px] p-4">
            <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                Filters
            </h2>
            <div className="text-sm text-background/70 space-y-4">
                <label className="block">
                    <span className="block text-xs font-semibold text-background/50 uppercase tracking-wide mb-1">
                        Sort by
                    </span>
                    <select
                        value={sortKey}
                        onChange={(event) =>
                            onSortKeyChange(event.target.value as SortKey)
                        }
                        className="w-full rounded-md border border-background/20 bg-surface px-2 py-1 text-background focus:border-accent outline-none"
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="block text-xs font-semibold text-background/50 uppercase tracking-wide mb-1">
                        Meets on
                    </span>
                    <select
                        value={dayFilter}
                        onChange={(event) =>
                            onDayFilterChange(event.target.value as DayFilter)
                        }
                        className="w-full rounded-md border border-background/20 bg-surface px-2 py-1 text-background focus:border-accent outline-none"
                    >
                        {DAY_FILTERS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="border-t border-background/10 pt-3 space-y-1">
                    <p>{validCount} valid schedules</p>
                    <p>{visibleCount} visible after filters</p>
                </div>
            </div>
        </aside>
    );
}
