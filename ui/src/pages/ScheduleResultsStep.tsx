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

export default function ScheduleResultsStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft } = useScheduleDraft();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [sortKey, setSortKey] = useState<SortKey>("earliestStart");
    const [dayFilter, setDayFilter] = useState<DayFilter>("all");
    const [selectedResultId, setSelectedResultId] = useState<string | null>(
        null,
    );
    const [devFixtureDraft, setDevFixtureDraft] =
        useState<ScheduleDraft | null>(null);
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
        try {
            await favoriteGeneratedSchedule({
                catalogId: activeDraft.catalogId,
                catalogSectionIds: schedule.sections.map(
                    (section) => section.catalogSectionId,
                ),
            });
            // TODO change the star to yellow or something
        } catch (err) {
            console.error("Failed to favorite generated schedule", err);
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
            />
            <ResultsDetailsPanel
                generationResult={generationResult}
                selectedSchedule={selectedSchedule}
                onBack={handleBack}
            />
        </>
    );
}
