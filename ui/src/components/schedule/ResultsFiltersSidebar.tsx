import { useState } from "react";
import type { GenerationViewState } from "@/utils/generationSession";
import {
    DAY_OPTIONS,
    SORT_OPTIONS,
    type MeetingDayCode,
    type SortDirection,
    type SortKey,
} from "@/utils/scheduleResults";

type ResultsFiltersSidebarProps = {
    view: GenerationViewState;
    generatedCount: number;
    filteredCount: number;
    loadedCount: number;
    hasMore: boolean;
    isQuerying?: boolean;
    queryError?: string | null;
    isExpired?: boolean;
    isFixture?: boolean;
    onApply: (view: GenerationViewState) => void;
    onLoadMore: () => void;
    onRegenerate: () => void;
};

function optionalNumber(value: string): number | null {
    return value === "" ? null : Number(value);
}

export default function ResultsFiltersSidebar({
    view,
    generatedCount,
    filteredCount,
    loadedCount,
    hasMore,
    isQuerying = false,
    queryError = null,
    isExpired = false,
    isFixture = false,
    onApply,
    onLoadMore,
    onRegenerate,
}: ResultsFiltersSidebarProps) {
    const [draftState, setDraftState] = useState({
        sourceView: view,
        draftView: view,
    });
    const draftView =
        draftState.sourceView === view ? draftState.draftView : view;

    const filters = draftView.filters;
    const excludedDays = filters.excludedDays ?? [];

    function updateFilter(
        patch: Partial<GenerationViewState["filters"]>,
    ): void {
        updateDraftView((current) => ({
            ...current,
            filters: {
                ...current.filters,
                ...patch,
            },
        }));
    }

    function updateDraftView(
        update: (current: GenerationViewState) => GenerationViewState,
    ): void {
        setDraftState((current) => {
            const currentView =
                current.sourceView === view ? current.draftView : view;
            return {
                sourceView: view,
                draftView: update(currentView),
            };
        });
    }

    function toggleExcludedDay(day: MeetingDayCode): void {
        updateFilter({
            excludedDays: excludedDays.includes(day)
                ? excludedDays.filter((value) => value !== day)
                : [...excludedDays, day],
        });
    }

    function resetView(): void {
        updateDraftView(() => ({
            filters: {
                allowUnratedInstructors: true,
                blockedTimes: view.filters.blockedTimes ?? [],
                excludedDays: [],
                maxMeetingDays: null,
                maxSingleGapMinutes: null,
                maxTotalGapMinutes: null,
                minimumInstructorRating: null,
                notAfter: null,
                notBefore: null,
            },
            sort: { direction: "asc", field: "earliestStart" },
            pageLimit: 50,
        }));
    }

    return (
        <aside className="bg-surface rounded-[10px] p-4 overflow-y-auto">
            <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                Filters
            </h2>
            <div className="text-sm text-background/70 space-y-4">
                <label className="block">
                    <span className="block text-xs font-semibold text-background/50 uppercase tracking-wide mb-1">
                        Sort by
                    </span>
                    <select
                        value={draftView.sort.field ?? "earliestStart"}
                        onChange={(event) =>
                            updateDraftView((current) => ({
                                ...current,
                                sort: {
                                    ...current.sort,
                                    field: event.target.value as SortKey,
                                },
                            }))
                        }
                        disabled={isFixture}
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
                        Direction
                    </span>
                    <select
                        value={draftView.sort.direction ?? "asc"}
                        onChange={(event) =>
                            updateDraftView((current) => ({
                                ...current,
                                sort: {
                                    ...current.sort,
                                    direction: event.target
                                        .value as SortDirection,
                                },
                            }))
                        }
                        disabled={isFixture}
                        className="w-full rounded-md border border-background/20 bg-surface px-2 py-1 text-background focus:border-accent outline-none"
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </label>

                <fieldset disabled={isFixture}>
                    <legend className="block text-xs font-semibold text-background/50 uppercase tracking-wide mb-2">
                        Avoid days
                    </legend>
                    <div className="grid grid-cols-2 gap-1">
                        {DAY_OPTIONS.map((option) => (
                            <label
                                key={option.value}
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="checkbox"
                                    checked={excludedDays.includes(option.value)}
                                    onChange={() =>
                                        toggleExcludedDay(option.value)
                                    }
                                />
                                {option.label.replace("Avoid ", "")}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-2">
                    <label>
                        <span className="block text-xs text-background/50 mb-1">
                            Not before
                        </span>
                        <input
                            type="time"
                            value={filters.notBefore ?? ""}
                            onChange={(event) =>
                                updateFilter({
                                    notBefore: event.target.value || null,
                                })
                            }
                            disabled={isFixture}
                            className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                        />
                    </label>
                    <label>
                        <span className="block text-xs text-background/50 mb-1">
                            Not after
                        </span>
                        <input
                            type="time"
                            value={filters.notAfter ?? ""}
                            onChange={(event) =>
                                updateFilter({
                                    notAfter: event.target.value || null,
                                })
                            }
                            disabled={isFixture}
                            className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="block text-xs text-background/50 mb-1">
                        Maximum meeting days
                    </span>
                    <input
                        type="number"
                        min="1"
                        max="6"
                        value={filters.maxMeetingDays ?? ""}
                        onChange={(event) =>
                            updateFilter({
                                maxMeetingDays: optionalNumber(
                                    event.target.value,
                                ),
                            })
                        }
                        disabled={isFixture}
                        className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                    />
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <label>
                        <span className="block text-xs text-background/50 mb-1">
                            Total gap max
                        </span>
                        <input
                            type="number"
                            min="0"
                            value={filters.maxTotalGapMinutes ?? ""}
                            onChange={(event) =>
                                updateFilter({
                                    maxTotalGapMinutes: optionalNumber(
                                        event.target.value,
                                    ),
                                })
                            }
                            disabled={isFixture}
                            className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                        />
                    </label>
                    <label>
                        <span className="block text-xs text-background/50 mb-1">
                            Single gap max
                        </span>
                        <input
                            type="number"
                            min="0"
                            value={filters.maxSingleGapMinutes ?? ""}
                            onChange={(event) =>
                                updateFilter({
                                    maxSingleGapMinutes: optionalNumber(
                                        event.target.value,
                                    ),
                                })
                            }
                            disabled={isFixture}
                            className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="block text-xs text-background/50 mb-1">
                        Minimum instructor rating
                    </span>
                    <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={filters.minimumInstructorRating ?? ""}
                        onChange={(event) =>
                            updateFilter({
                                minimumInstructorRating: optionalNumber(
                                    event.target.value,
                                ),
                            })
                        }
                        disabled={isFixture}
                        className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                    />
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={filters.allowUnratedInstructors ?? true}
                        onChange={(event) =>
                            updateFilter({
                                allowUnratedInstructors: event.target.checked,
                            })
                        }
                        disabled={isFixture}
                    />
                    Allow unrated instructors
                </label>

                <label className="block">
                    <span className="block text-xs text-background/50 mb-1">
                        Results per request
                    </span>
                    <select
                        value={draftView.pageLimit}
                        onChange={(event) =>
                            updateDraftView((current) => ({
                                ...current,
                                pageLimit: Number(event.target.value),
                            }))
                        }
                        disabled={isFixture}
                        className="w-full rounded-md border border-background/20 bg-surface px-2 py-1"
                    >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </label>

                {(filters.blockedTimes?.length ?? 0) > 0 ? (
                    <p className="text-xs text-background/50">
                        {filters.blockedTimes?.length} builder blocked-time
                        constraint(s) remain applied.
                    </p>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => onApply(draftView)}
                        disabled={isQuerying || isFixture}
                        className="rounded-md bg-accent px-3 py-2 font-semibold text-white disabled:opacity-50"
                    >
                        Apply
                    </button>
                    <button
                        type="button"
                        onClick={resetView}
                        disabled={isQuerying || isFixture}
                        className="rounded-md border border-background/20 px-3 py-2 disabled:opacity-50"
                    >
                        Reset
                    </button>
                </div>

                <div className="border-t border-background/10 pt-3 space-y-1">
                    <p>{generatedCount} generated schedules</p>
                    <p>{filteredCount} match these filters</p>
                    <p>{loadedCount} currently displayed</p>
                    {isQuerying ? <p>Updating results…</p> : null}
                    {queryError ? (
                        <p className="text-red-600">{queryError}</p>
                    ) : null}
                    {isExpired ? (
                        <button
                            type="button"
                            onClick={onRegenerate}
                            disabled={isQuerying}
                            className="mt-2 w-full rounded-md bg-accent px-3 py-2 font-semibold text-white disabled:opacity-50"
                        >
                            Regenerate expired session
                        </button>
                    ) : null}
                    {hasMore && !isExpired ? (
                        <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={isQuerying}
                            className="mt-2 w-full rounded-md border border-background/20 px-3 py-2 font-semibold disabled:opacity-50"
                        >
                            Load more
                        </button>
                    ) : null}
                </div>
            </div>
        </aside>
    );
}
