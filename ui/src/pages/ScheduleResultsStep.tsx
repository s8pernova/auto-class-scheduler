import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
    useNavigate,
    useParams,
    Navigate,
    useSearchParams,
} from "react-router-dom";
import {
    type ScheduleDraft,
    useScheduleDraft,
} from "@/contexts/ScheduleDraftContext";
import {
    favoriteGeneratedSchedule,
    queryGenerationSession,
    unfavoriteSchedule,
} from "@/api";
import type { GeneratedScheduleResponse } from "@/api";
import ResultsFiltersSidebar from "@/components/schedule/ResultsFiltersSidebar";
import ResultsGrid from "@/components/schedule/ResultsGrid";
import ResultsDetailsPanel from "@/components/schedule/ResultsDetailsPanel";
import {
    filterSchedulesByExcludedDay,
    sortSchedules,
    type DayFilter,
    type SortKey,
} from "@/utils/scheduleResults";

const EMPTY_SCHEDULES: GeneratedScheduleResponse[] = [];
const DEV_RESULTS_FIXTURE_PARAM = "fixture";

type FavoriteState = {
    scheduleId: number | null;
    isSaving: boolean;
    error: string | null;
};

function getGeneratedScheduleFavoriteKey(
    schedule: GeneratedScheduleResponse,
): string {
    const sectionRowIds = schedule.sections
        .map((section) => section.catalogSectionMeetingId)
        .sort();

    return sectionRowIds.length > 0
        ? sectionRowIds.join("|")
        : schedule.resultId;
}

function getDevFixtureScheduleId(schedule: GeneratedScheduleResponse): number {
    return Math.abs(
        Array.from(schedule.resultId).reduce(
            (hash, char) => (hash * 31 + char.charCodeAt(0)) | 0,
            0,
        ),
    );
}

export default function ScheduleResultsStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, isDraftLoading, draftError, setGenerationResult } =
        useScheduleDraft();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [sortKey, setSortKey] = useState<SortKey>("earliestStart");
    const [dayFilter, setDayFilter] = useState<DayFilter>("all");
    const [selectedResultId, setSelectedResultId] = useState<string | null>(
        null,
    );
    const [devFixtureDraft, setDevFixtureDraft] =
        useState<ScheduleDraft | null>(null);
    const [favoriteStates, setFavoriteStates] = useState<
        Record<string, FavoriteState>
    >({});
    const [hasChangedViewControls, setHasChangedViewControls] = useState(false);
    const [isQueryingGenerationSession, setIsQueryingGenerationSession] =
        useState(false);
    const [generationSessionQueryError, setGenerationSessionQueryError] =
        useState<string | null>(null);
    const [isLoadingDevFixture, setIsLoadingDevFixture] = useState(false);
    const [didFailDevFixture, setDidFailDevFixture] = useState(false);
    const fixtureName = searchParams.get(DEV_RESULTS_FIXTURE_PARAM);
    const shouldLoadDevFixture = import.meta.env.DEV && fixtureName !== null;

    useEffect(() => {
        if (!shouldLoadDevFixture) {
            setDevFixtureDraft(null);
            setIsLoadingDevFixture(false);
            setDidFailDevFixture(false);
            return;
        }

        let isCurrent = true;
        setIsLoadingDevFixture(true);
        setDidFailDevFixture(false);

        import("@/dev/scheduleResultsFixtures")
            .then(({ getScheduleResultsDevFixture }) => {
                if (isCurrent) {
                    const fixtureDraft = getScheduleResultsDevFixture(
                        fixtureName,
                        catalogId ?? draft.catalogId,
                    );
                    setDevFixtureDraft(fixtureDraft);
                    setDidFailDevFixture(fixtureDraft === null);
                }
            })
            .catch((err) => {
                console.error("Failed to load schedule results fixture", err);
                if (isCurrent) {
                    setDevFixtureDraft(null);
                    setDidFailDevFixture(true);
                }
            })
            .finally(() => {
                if (isCurrent) {
                    setIsLoadingDevFixture(false);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [catalogId, draft.catalogId, fixtureName, shouldLoadDevFixture]);

    const activeDraft = devFixtureDraft ?? draft;
    const isUsingDevFixture = devFixtureDraft !== null;
    const generationResult = activeDraft.generationResult;
    const allSchedules = generationResult?.schedules ?? EMPTY_SCHEDULES;
    const visibleSchedules = useMemo(() => {
        if (!isUsingDevFixture) {
            return allSchedules;
        }

        return sortSchedules(
            filterSchedulesByExcludedDay(allSchedules, dayFilter),
            sortKey,
        );
    }, [allSchedules, dayFilter, isUsingDevFixture, sortKey]);

    useEffect(() => {
        if (
            isUsingDevFixture ||
            !hasChangedViewControls ||
            !generationResult?.sessionId
        ) {
            setGenerationSessionQueryError(null);
            setIsQueryingGenerationSession(false);
            return;
        }

        let isCurrent = true;
        setIsQueryingGenerationSession(true);
        setGenerationSessionQueryError(null);

        queryGenerationSession(generationResult.sessionId, {
            filters: {
                excludedDays: dayFilter === "all" ? [] : [dayFilter],
            },
            page: {
                offset: 0,
                limit: generationResult.pageLimit ?? 50,
            },
            sort: {
                direction: "asc",
                field: sortKey,
            },
        })
            .then((nextGenerationResult) => {
                if (!isCurrent) {
                    return;
                }
                setGenerationResult(nextGenerationResult);
                setSelectedResultId((currentResultId) => {
                    if (
                        currentResultId &&
                        nextGenerationResult.schedules.some(
                            (schedule) => schedule.resultId === currentResultId,
                        )
                    ) {
                        return currentResultId;
                    }
                    return nextGenerationResult.schedules[0]?.resultId ?? null;
                });
            })
            .catch((err) => {
                if (!isCurrent) {
                    return;
                }
                setGenerationSessionQueryError(
                    err instanceof Error
                        ? err.message
                        : "Failed to update generated schedules.",
                );
            })
            .finally(() => {
                if (isCurrent) {
                    setIsQueryingGenerationSession(false);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [
        dayFilter,
        generationResult?.pageLimit,
        generationResult?.sessionId,
        hasChangedViewControls,
        isUsingDevFixture,
        setGenerationResult,
        sortKey,
    ]);
    const favoriteStateByResultId = useMemo(
        () =>
            Object.fromEntries(
                visibleSchedules.map((schedule) => [
                    schedule.resultId,
                    favoriteStates[getGeneratedScheduleFavoriteKey(schedule)],
                ]),
            ),
        [favoriteStates, visibleSchedules],
    );
    const selectedSchedule =
        visibleSchedules.find(
            (schedule) => schedule.resultId === selectedResultId,
        ) ??
        visibleSchedules[0] ??
        null;

    if (
        shouldLoadDevFixture &&
        !didFailDevFixture &&
        (isLoadingDevFixture || !devFixtureDraft)
    ) {
        return (
            <div className="h-full flex items-center justify-center text-background/50 text-sm">
                Loading results fixture.
            </div>
        );
    }

    if (!isUsingDevFixture && isDraftLoading) {
        return (
            <div className="h-full flex items-center justify-center text-background/50 text-sm">
                Loading catalog sections.
            </div>
        );
    }

    if (!isUsingDevFixture && draftError) {
        return (
            <div className="h-full flex items-center justify-center text-background/60 text-sm">
                {draftError}
            </div>
        );
    }

    if (activeDraft.requirementCourses.length === 0) {
        return <Navigate to={`/catalogs/${catalogId}/build`} replace />;
    }

    if (!generationResult) {
        return <Navigate to={`/catalogs/${catalogId}/build`} replace />;
    }

    function handleBack() {
        navigate(`/catalogs/${catalogId}/build`);
    }

    function handleSortKeyChange(nextSortKey: SortKey) {
        setHasChangedViewControls(true);
        setSortKey(nextSortKey);
    }

    function handleDayFilterChange(nextDayFilter: DayFilter) {
        setHasChangedViewControls(true);
        setDayFilter(nextDayFilter);
    }

    async function handleFavorite(
        e: MouseEvent<HTMLButtonElement>,
        schedule: GeneratedScheduleResponse,
    ) {
        e.stopPropagation();
        const favoriteKey = getGeneratedScheduleFavoriteKey(schedule);
        const currentState = favoriteStates[favoriteKey];
        const savedScheduleId = currentState?.scheduleId ?? null;

        if (currentState?.isSaving) {
            return;
        }

        setFavoriteStates((prev) => ({
            ...prev,
            [favoriteKey]: {
                scheduleId: savedScheduleId,
                isSaving: true,
                error: null,
            },
        }));

        if (savedScheduleId !== null) {
            if (isUsingDevFixture) {
                setFavoriteStates((prev) => ({
                    ...prev,
                    [favoriteKey]: {
                        scheduleId: null,
                        isSaving: false,
                        error: null,
                    },
                }));
                return;
            }

            try {
                await unfavoriteSchedule(savedScheduleId);
                setFavoriteStates((prev) => ({
                    ...prev,
                    [favoriteKey]: {
                        scheduleId: null,
                        isSaving: false,
                        error: null,
                    },
                }));
            } catch (err) {
                setFavoriteStates((prev) => ({
                    ...prev,
                    [favoriteKey]: {
                        scheduleId: savedScheduleId,
                        isSaving: false,
                        error:
                            err instanceof Error
                                ? err.message
                                : "Failed to unfavorite schedule.",
                    },
                }));
            }
            return;
        }

        if (isUsingDevFixture) {
            setFavoriteStates((prev) => ({
                ...prev,
                [favoriteKey]: {
                    scheduleId: getDevFixtureScheduleId(schedule),
                    isSaving: false,
                    error: null,
                },
            }));
            return;
        }

        try {
            const response = await favoriteGeneratedSchedule({
                catalogId: activeDraft.catalogId,
                catalogSectionMeetingIds: schedule.sections.map(
                    (section) => section.catalogSectionMeetingId,
                ),
            });
            setFavoriteStates((prev) => ({
                ...prev,
                [favoriteKey]: {
                    scheduleId: response.scheduleId,
                    isSaving: false,
                    error: null,
                },
            }));
        } catch (err) {
            setFavoriteStates((prev) => ({
                ...prev,
                [favoriteKey]: {
                    scheduleId: prev[favoriteKey]?.scheduleId ?? null,
                    isSaving: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : "Failed to favorite schedule.",
                },
            }));
        }
    }

    return (
        <>
            <ResultsFiltersSidebar
                sortKey={sortKey}
                dayFilter={dayFilter}
                validCount={generationResult.validCount}
                visibleCount={visibleSchedules.length}
                isQuerying={isQueryingGenerationSession}
                queryError={generationSessionQueryError}
                onSortKeyChange={handleSortKeyChange}
                onDayFilterChange={handleDayFilterChange}
            />
            <ResultsGrid
                schedules={visibleSchedules}
                selectedSchedule={selectedSchedule}
                onSelectSchedule={setSelectedResultId}
                onFavorite={handleFavorite}
                favoriteStates={favoriteStateByResultId}
            />
            <ResultsDetailsPanel
                generationResult={generationResult}
                selectedSchedule={selectedSchedule}
                onBack={handleBack}
            />
        </>
    );
}
