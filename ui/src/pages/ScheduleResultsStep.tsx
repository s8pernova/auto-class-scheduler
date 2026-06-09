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
import { favoriteGeneratedSchedule } from "@/api";
import type { GeneratedScheduleResponse } from "@/api";
import ResultsFiltersSidebar from "@/components/schedule/ResultsFiltersSidebar";
import ResultsGrid from "@/components/schedule/ResultsGrid";
import ResultsDetailsPanel from "@/components/schedule/ResultsDetailsPanel";
import {
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
    const sectionIds = schedule.sections
        .map((section) => section.catalogSectionId)
        .sort();

    return sectionIds.length > 0 ? sectionIds.join("|") : schedule.resultId;
}

export default function ScheduleResultsStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft, isDraftLoading, draftError } = useScheduleDraft();
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
        const filtered = allSchedules.filter((schedule) => {
            const matchesDay =
                dayFilter === "all" ? true : Boolean(schedule[dayFilter]);

            return matchesDay;
        });

        return sortSchedules(filtered, sortKey);
    }, [allSchedules, dayFilter, sortKey]);
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

    async function handleFavorite(
        e: MouseEvent<HTMLButtonElement>,
        schedule: GeneratedScheduleResponse,
    ) {
        e.stopPropagation();
        const favoriteKey = getGeneratedScheduleFavoriteKey(schedule);
        const currentState = favoriteStates[favoriteKey];

        if (currentState?.isSaving || currentState?.scheduleId) {
            return;
        }

        setFavoriteStates((prev) => ({
            ...prev,
            [favoriteKey]: {
                scheduleId: prev[favoriteKey]?.scheduleId ?? null,
                isSaving: true,
                error: null,
            },
        }));

        try {
            const response = await favoriteGeneratedSchedule({
                catalogId: activeDraft.catalogId,
                catalogSectionIds: schedule.sections.map(
                    (section) => section.catalogSectionId,
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
                onSortKeyChange={setSortKey}
                onDayFilterChange={setDayFilter}
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
