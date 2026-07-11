import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
    useNavigate,
    useParams,
    Navigate,
    useSearchParams,
} from "react-router-dom";
import { type ScheduleDraft } from "@/contexts/ScheduleDraftContext";
import { useScheduleDraft } from "@/hooks/useScheduleDraft";
import {
    createGenerationSession,
    favoriteGeneratedSchedule,
    getFavoriteSchedules,
    queryGenerationSessionResults,
    unfavoriteSchedule,
} from "@/api";
import type { GeneratedScheduleResponse, ScheduleSummaryResponse } from "@/api";
import ResultsFiltersSidebar from "@/components/schedule/ResultsFiltersSidebar";
import ResultsGrid from "@/components/schedule/ResultsGrid";
import ResultsDetailsPanel from "@/components/schedule/ResultsDetailsPanel";
import SavedSchedulesGrid from "@/components/schedule/SavedSchedulesGrid";
import SavedScheduleDetailsPanel from "@/components/schedule/SavedScheduleDetailsPanel";
import { useAuth } from "@/hooks/useAuth";
import { buildGenerationSessionRequest } from "@/utils/buildGenerationSessionRequest";
import {
    getGeneratedScheduleFavoriteKey,
    getSavedScheduleFavoriteKey,
} from "@/utils/scheduleFavorites";
import {
    buildGenerationSessionQueryRequest,
    getGenerationSessionErrorMessage,
    isGenerationSessionExpiredError,
    mergeGenerationSessionPages,
    type GenerationViewState,
} from "@/utils/generationSession";

const EMPTY_SCHEDULES: GeneratedScheduleResponse[] = [];
const DEV_RESULTS_FIXTURE_PARAM = "fixture";

type FavoriteState = {
    scheduleId: number | null;
    isSaving: boolean;
    error: string | null;
};

type FavoriteLoadState = "idle" | "loading" | "success" | "error";

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
    const { status: authStatus, user } = useAuth();
    const {
        draft,
        isDraftLoading,
        draftError,
        setGenerationResult,
        setGenerationView,
    } = useScheduleDraft();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [selectedResultId, setSelectedResultId] = useState<string | null>(
        null,
    );
    const [devFixtureDraft, setDevFixtureDraft] =
        useState<ScheduleDraft | null>(null);
    const [favoriteStates, setFavoriteStates] = useState<
        Record<string, FavoriteState>
    >({});
    const [favoriteSchedules, setFavoriteSchedules] = useState<
        ScheduleSummaryResponse[]
    >([]);
    const [selectedFavoriteScheduleId, setSelectedFavoriteScheduleId] = useState<
        number | null
    >(null);
    const [favoriteLoadState, setFavoriteLoadState] =
        useState<FavoriteLoadState>("idle");
    const [favoriteLoadError, setFavoriteLoadError] = useState<string | null>(
        null,
    );
    const [isQueryingGenerationSession, setIsQueryingGenerationSession] =
        useState(false);
    const [generationSessionQueryError, setGenerationSessionQueryError] =
        useState<string | null>(null);
    const [isGenerationSessionExpired, setIsGenerationSessionExpired] =
        useState(false);
    const [isLoadingDevFixture, setIsLoadingDevFixture] = useState(false);
    const [didFailDevFixture, setDidFailDevFixture] = useState(false);
    const fixtureName = searchParams.get(DEV_RESULTS_FIXTURE_PARAM);
    const showFavoritesOnly = searchParams.get("favorites") === "true";
    const shouldLoadDevFixture = import.meta.env.DEV && fixtureName !== null;
    const isKnownUser = authStatus === "signed_in" && !user?.is_anonymous;

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

    useEffect(() => {
        let isCurrent = true;

        async function loadPersistedFavorites() {
            await Promise.resolve();
            if (!isCurrent) {
                return;
            }

            if (!isKnownUser || isUsingDevFixture) {
                if (!isUsingDevFixture) {
                    setFavoriteStates({});
                    setFavoriteSchedules([]);
                    setSelectedFavoriteScheduleId(null);
                }
                setFavoriteLoadState("idle");
                setFavoriteLoadError(null);
                return;
            }

            setFavoriteStates({});
            setFavoriteLoadState("loading");
            setFavoriteLoadError(null);

            try {
                const savedSchedules = await getFavoriteSchedules();
                if (!isCurrent) {
                    return;
                }

                setFavoriteSchedules(savedSchedules);
                setSelectedFavoriteScheduleId((currentScheduleId) => {
                    if (
                        currentScheduleId !== null &&
                        savedSchedules.some(
                            (schedule) =>
                                schedule.schedule_id === currentScheduleId,
                        )
                    ) {
                        return currentScheduleId;
                    }

                    return savedSchedules[0]?.schedule_id ?? null;
                });

                const loadedStates: Record<string, FavoriteState> =
                    Object.fromEntries(
                        savedSchedules.flatMap((schedule) => {
                            const favoriteKey =
                                getSavedScheduleFavoriteKey(schedule);
                            return favoriteKey
                                ? [
                                      [
                                          favoriteKey,
                                          {
                                              scheduleId: schedule.schedule_id,
                                              isSaving: false,
                                              error: null,
                                          } satisfies FavoriteState,
                                      ] as const,
                                  ]
                                : [];
                        }),
                    );

                setFavoriteStates((currentStates) => {
                    const nextStates = { ...loadedStates };
                    for (const [key, state] of Object.entries(currentStates)) {
                        if (state.isSaving || state.scheduleId !== null) {
                            nextStates[key] = state;
                        }
                    }
                    return nextStates;
                });
                setFavoriteLoadState("success");
            } catch (err) {
                if (!isCurrent) {
                    return;
                }
                setFavoriteSchedules([]);
                setSelectedFavoriteScheduleId(null);
                setFavoriteLoadState("error");
                setFavoriteLoadError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load favorite schedules.",
                );
            }
        }

        void loadPersistedFavorites();

        return () => {
            isCurrent = false;
        };
    }, [activeDraft.catalogId, isKnownUser, isUsingDevFixture]);

    const visibleSchedules = allSchedules;
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
    const selectedFavoriteSchedule =
        favoriteSchedules.find(
            (schedule) => schedule.schedule_id === selectedFavoriteScheduleId,
        ) ??
        favoriteSchedules[0] ??
        null;
    const isFavoriteDataLoading =
        !isUsingDevFixture &&
        (authStatus === "booting" ||
            (isKnownUser &&
                (favoriteLoadState === "idle" ||
                    favoriteLoadState === "loading")));
    const emptyFavoritesMessage = showFavoritesOnly
        ? isFavoriteDataLoading
            ? "Loading favorite schedules."
            : favoriteLoadState === "error"
              ? (favoriteLoadError ?? "Failed to load favorite schedules.")
              : "No favorite schedules yet."
        : undefined;

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

    function handleGenerationSessionError(
        err: unknown,
        fallback: string,
    ): void {
        const expired = isGenerationSessionExpiredError(err);
        setIsGenerationSessionExpired(expired);
        setGenerationSessionQueryError(
            getGenerationSessionErrorMessage(err, fallback),
        );
    }

    function selectFirstAvailableSchedule(
        schedules: GeneratedScheduleResponse[],
    ): void {
        setSelectedResultId((currentResultId) => {
            if (
                currentResultId &&
                schedules.some(
                    (schedule) => schedule.resultId === currentResultId,
                )
            ) {
                return currentResultId;
            }
            return schedules[0]?.resultId ?? null;
        });
    }

    async function handleApplyView(nextView: GenerationViewState) {
        if (isUsingDevFixture || !generationResult?.sessionId) {
            return;
        }

        setIsQueryingGenerationSession(true);
        setGenerationSessionQueryError(null);
        setIsGenerationSessionExpired(false);

        try {
            const nextResult = await queryGenerationSessionResults(
                generationResult.sessionId,
                buildGenerationSessionQueryRequest(nextView, null),
            );
            setGenerationView(nextView);
            setGenerationResult(nextResult);
            selectFirstAvailableSchedule(nextResult.schedules);
        } catch (err) {
            handleGenerationSessionError(
                err,
                "Failed to update generated schedules.",
            );
        } finally {
            setIsQueryingGenerationSession(false);
        }
    }

    async function handleLoadMore() {
        if (
            isUsingDevFixture ||
            !generationResult?.sessionId ||
            !generationResult.nextCursor
        ) {
            return;
        }

        setIsQueryingGenerationSession(true);
        setGenerationSessionQueryError(null);

        try {
            const nextPage = await queryGenerationSessionResults(
                generationResult.sessionId,
                buildGenerationSessionQueryRequest(
                    draft.generationView,
                    generationResult.nextCursor,
                ),
            );
            setGenerationResult(
                mergeGenerationSessionPages(generationResult, nextPage),
            );
        } catch (err) {
            handleGenerationSessionError(
                err,
                "Failed to load more generated schedules.",
            );
        } finally {
            setIsQueryingGenerationSession(false);
        }
    }

    async function handleRegenerate() {
        if (isUsingDevFixture) {
            return;
        }

        setIsQueryingGenerationSession(true);
        setGenerationSessionQueryError(null);

        try {
            const nextResult = await createGenerationSession(
                buildGenerationSessionRequest(draft),
            );
            setGenerationResult(nextResult);
            setIsGenerationSessionExpired(false);
            selectFirstAvailableSchedule(nextResult.schedules);
        } catch (err) {
            handleGenerationSessionError(
                err,
                "Failed to regenerate schedules.",
            );
        } finally {
            setIsQueryingGenerationSession(false);
        }
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
                view={activeDraft.generationView}
                generatedCount={generationResult.generatedCount}
                filteredCount={generationResult.filteredCount}
                loadedCount={visibleSchedules.length}
                hasMore={generationResult.nextCursor != null}
                isQuerying={isQueryingGenerationSession}
                queryError={generationSessionQueryError}
                isExpired={isGenerationSessionExpired}
                isFixture={isUsingDevFixture}
                onApply={handleApplyView}
                onLoadMore={handleLoadMore}
                onRegenerate={handleRegenerate}
            />
            {showFavoritesOnly ? (
                <>
                    <SavedSchedulesGrid
                        schedules={favoriteSchedules}
                        selectedSchedule={selectedFavoriteSchedule}
                        onSelectSchedule={setSelectedFavoriteScheduleId}
                        emptyMessage={emptyFavoritesMessage}
                    />
                    <SavedScheduleDetailsPanel
                        schedules={favoriteSchedules}
                        selectedSchedule={selectedFavoriteSchedule}
                        isLoading={isFavoriteDataLoading}
                        error={
                            favoriteLoadState === "error"
                                ? favoriteLoadError
                                : null
                        }
                        onBack={handleBack}
                    />
                </>
            ) : (
                <>
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
                        blockedTimes={
                            activeDraft.generationView.filters.blockedTimes
                        }
                        onBack={handleBack}
                    />
                </>
            )}
        </>
    );
}
