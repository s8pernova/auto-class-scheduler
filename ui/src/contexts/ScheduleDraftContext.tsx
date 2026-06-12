import {
    forkCatalog,
    getCatalog,
    getCatalogSections,
    publishCatalog,
    type CatalogSectionResponse,
    type CatalogResponse,
    type ScheduleGenerateResponse,
} from "@/api";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

// Types

export interface SectionRef {
    days: string;
    time: string;
    crn?: string;
    instructor?: string;
    rating?: string;
}

export interface RequirementCourse {
    id: string;
    label: string;
    sections: SectionRef[];
}

export interface RequirementGroup {
    id: string;
    name?: string;
    courseIds: string[];
    choose: number;
}

export interface BlockedTime {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export type InstructorRatings = Record<string, number | null>;
export type CatalogStatus = CatalogResponse["status"];

export interface ScheduleDraft {
    catalogId: string;
    requirementCourses: RequirementCourse[];
    requirementGroups: RequirementGroup[];
    blockedTimes: BlockedTime[];
    instructorRatings: InstructorRatings;
    generationResult: ScheduleGenerateResponse | null;
}

type CatalogDraftPatch = Partial<Pick<ScheduleDraft, "requirementCourses">>;
type ScheduleRequestPatch = Partial<
    Pick<
        ScheduleDraft,
        "requirementGroups" | "blockedTimes" | "instructorRatings"
    >
>;

interface ScheduleDraftContextType {
    draft: ScheduleDraft;
    catalog: CatalogResponse | null;
    catalogStatus: CatalogStatus | null;
    shareSlug: string | null;
    isPublished: boolean;
    isSharedEntry: boolean;
    forkedFromCatalogId: string | null;
    isCatalogLoading: boolean;
    catalogError: string | null;
    isDraftLoading: boolean;
    draftError: string | null;
    isCatalogDraftDirty: boolean;
    isForkingCatalog: boolean;
    forkError: string | null;
    isPublishingCatalog: boolean;
    publishError: string | null;
    updateCatalogDraft: (patch: CatalogDraftPatch) => void;
    updateScheduleRequest: (patch: ScheduleRequestPatch) => void;
    setGenerationResult: (result: ScheduleGenerateResponse | null) => void;
    resetDraft: () => void;
    refreshCatalog: () => Promise<void>;
    refreshDraft: () => Promise<void>;
    markCatalogDraftClean: () => void;
    ensureEditableCatalog: () => Promise<CatalogResponse>;
    publishCurrentCatalog: (catalogIdOverride?: string) => Promise<CatalogResponse>;
}

// Context

const ScheduleDraftContext = createContext<ScheduleDraftContextType | null>(
    null,
);

const SCHEDULE_REQUEST_KEYS = [
    "requirementGroups",
    "blockedTimes",
    "instructorRatings",
] as const;

function patchHasKey<T extends object, K extends keyof T>(
    patch: Partial<T>,
    key: K,
): boolean {
    return Object.prototype.hasOwnProperty.call(patch, key);
}

function patchHasAnyKey<T extends object, K extends keyof T>(
    patch: Partial<T>,
    keys: readonly K[],
): boolean {
    return keys.some((key) =>
        Object.prototype.hasOwnProperty.call(patch, key),
    );
}

function buildInitialDraft(catalogId: string): ScheduleDraft {
    return {
        catalogId,
        requirementCourses: [],
        requirementGroups: [],
        blockedTimes: [],
        instructorRatings: {},
        generationResult: null,
    };
}

function slugifyCourseId(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "course"
    );
}

function formatMeetingTime(value: string): string {
    const [hours, minutes] = value.trim().split(":");

    if (!hours || !minutes) {
        return value.trim();
    }

    return `${hours.padStart(2, "0")}:${minutes}`;
}

function buildDraftFromCatalogSections(
    catalogId: string,
    sections: CatalogSectionResponse[],
): ScheduleDraft {
    const sortedSections = [...sections].sort(
        (left, right) => left.sortOrder - right.sortOrder,
    );
    const requirementCourses = sortedSections.map((section, index) => {
        const label = section.courseName.trim();
        const meetings = [...(section.meetings ?? [])].sort(
            (left, right) => left.sortOrder - right.sortOrder,
        );

        return {
            id: `course-${slugifyCourseId(label)}-${index}`,
            label,
            sections: meetings.map((meeting) => ({
                days: meeting.days ?? "",
                time: `${formatMeetingTime(meeting.startTime)}-${formatMeetingTime(
                    meeting.endTime,
                )}`,
                crn: meeting.crn ?? "",
                instructor: meeting.instructorName ?? "",
            })),
        };
    });

    return {
        catalogId,
        requirementCourses,
        requirementGroups: requirementCourses.map((course) => ({
            id: `group-${course.id}`,
            courseIds: [course.id],
            choose: 1,
        })),
        blockedTimes: [],
        instructorRatings: {},
        generationResult: null,
    };
}

// Provider

interface ScheduleDraftProviderProps {
    catalogId: string;
    children: ReactNode;
    entryCatalog?: CatalogResponse;
    entryDraft?: ScheduleDraft;
    entryShareSlug?: string;
    isSharedEntry?: boolean;
}

function isMatchingEntryCatalog(
    catalogId: string,
    catalog: CatalogResponse | undefined,
): catalog is CatalogResponse {
    return catalog?.id === catalogId;
}

function isMatchingEntryDraft(
    catalogId: string,
    draft: ScheduleDraft | undefined,
): draft is ScheduleDraft {
    return draft?.catalogId === catalogId;
}

function getCatalogErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : "Failed to fetch catalog.";
}

function getDraftErrorMessage(err: unknown): string {
    return err instanceof Error
        ? err.message
        : "Failed to fetch catalog sections.";
}

function getForkErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : "Failed to fork catalog.";
}

function getPublishErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : "Failed to publish catalog.";
}

export function ScheduleDraftProvider({
    catalogId,
    children,
    entryCatalog,
    entryDraft,
    entryShareSlug,
    isSharedEntry = false,
}: ScheduleDraftProviderProps) {
    const initialCatalog = isMatchingEntryCatalog(catalogId, entryCatalog)
        ? entryCatalog
        : null;
    const initialEntryDraft = isMatchingEntryDraft(catalogId, entryDraft)
        ? entryDraft
        : null;
    const initialDraft = initialEntryDraft ?? buildInitialDraft(catalogId);
    const [draft, setDraft] = useState<ScheduleDraft>(() =>
        initialDraft,
    );
    const [catalog, setCatalog] = useState<CatalogResponse | null>(
        initialCatalog,
    );
    const [isCatalogLoading, setIsCatalogLoading] = useState(
        initialCatalog === null,
    );
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [isDraftLoading, setIsDraftLoading] = useState(
        initialEntryDraft === null,
    );
    const [draftError, setDraftError] = useState<string | null>(null);
    const [isCatalogDraftDirty, setIsCatalogDraftDirty] = useState(false);
    const [isForkingCatalog, setIsForkingCatalog] = useState(false);
    const [forkError, setForkError] = useState<string | null>(null);
    const [isPublishingCatalog, setIsPublishingCatalog] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);

    const refreshCatalog = useCallback(async () => {
        setIsCatalogLoading(true);
        setCatalogError(null);

        try {
            const nextCatalog = await getCatalog(catalogId);
            setCatalog(nextCatalog);
        } catch (err) {
            setCatalogError(getCatalogErrorMessage(err));
        } finally {
            setIsCatalogLoading(false);
        }
    }, [catalogId]);

    const refreshDraft = useCallback(async () => {
        setIsDraftLoading(true);
        setDraftError(null);

        try {
            const sections = await getCatalogSections(catalogId);
            setDraft(buildDraftFromCatalogSections(catalogId, sections));
            setIsCatalogDraftDirty(false);
        } catch (err) {
            setDraftError(getDraftErrorMessage(err));
        } finally {
            setIsDraftLoading(false);
        }
    }, [catalogId]);

    useEffect(() => {
        let isCurrent = true;
        const seededCatalog = isMatchingEntryCatalog(catalogId, entryCatalog)
            ? entryCatalog
            : null;
        const seededDraft = isMatchingEntryDraft(catalogId, entryDraft)
            ? entryDraft
            : null;

        setDraft(seededDraft ?? buildInitialDraft(catalogId));
        setCatalog(seededCatalog);
        setCatalogError(null);
        setDraftError(null);
        setForkError(null);
        setPublishError(null);
        setIsCatalogDraftDirty(false);

        if (seededDraft) {
            setIsDraftLoading(false);
        } else {
            setIsDraftLoading(true);
            getCatalogSections(catalogId)
                .then((sections) => {
                    if (!isCurrent) return;
                    setDraft(buildDraftFromCatalogSections(catalogId, sections));
                    setIsCatalogDraftDirty(false);
                })
                .catch((err) => {
                    if (!isCurrent) return;
                    setDraftError(getDraftErrorMessage(err));
                })
                .finally(() => {
                    if (!isCurrent) return;
                    setIsDraftLoading(false);
                });
        }

        if (seededCatalog) {
            setIsCatalogLoading(false);
            return () => {
                isCurrent = false;
            };
        }

        setIsCatalogLoading(true);

        getCatalog(catalogId)
            .then((nextCatalog) => {
                if (!isCurrent) return;
                setCatalog(nextCatalog);
            })
            .catch((err) => {
                if (!isCurrent) return;
                setCatalogError(getCatalogErrorMessage(err));
            })
            .finally(() => {
                if (!isCurrent) return;
                setIsCatalogLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [catalogId, entryCatalog, entryDraft]);

    const updateCatalogDraft = useCallback(
        (patch: CatalogDraftPatch) => {
            if (!patchHasKey(patch, "requirementCourses")) {
                return;
            }

            setDraft((prev) => {
                return {
                    ...prev,
                    ...patch,
                    generationResult: null,
                };
            });
            setIsCatalogDraftDirty(true);
        },
        [],
    );

    const updateScheduleRequest = useCallback(
        (patch: ScheduleRequestPatch) => {
            setDraft((prev) => ({
                ...prev,
                ...patch,
                generationResult: patchHasAnyKey(
                    patch,
                    SCHEDULE_REQUEST_KEYS,
                )
                    ? null
                    : prev.generationResult,
            }));
        },
        [],
    );

    const setGenerationResult = useCallback(
        (result: ScheduleGenerateResponse | null) => {
            setDraft((prev) => ({
                ...prev,
                generationResult: result,
            }));
        },
        [],
    );

    const resetDraft = useCallback(() => {
        setDraft(buildInitialDraft(catalogId));
        setIsCatalogDraftDirty(false);
    }, [catalogId]);

    const markCatalogDraftClean = useCallback(() => {
        setIsCatalogDraftDirty(false);
    }, []);

    const catalogStatus = catalog?.status ?? null;
    const shareSlug = catalog?.share_slug ?? entryShareSlug ?? null;
    const forkedFromCatalogId = catalog?.forked_from_catalog_id ?? null;
    const isPublished = catalogStatus === "published";

    const ensureEditableCatalog = useCallback(async (): Promise<CatalogResponse> => {
        setForkError(null);

        const currentCatalog = catalog ?? (await getCatalog(catalogId));
        const needsFork =
            isSharedEntry ||
            currentCatalog.status === "published" ||
            currentCatalog.source_type === "demo";

        if (!needsFork) {
            return currentCatalog;
        }

        setIsForkingCatalog(true);

        try {
            const forkedCatalog = await forkCatalog(catalogId);
            setCatalog(forkedCatalog);
            return forkedCatalog;
        } catch (err) {
            const message = getForkErrorMessage(err);
            setForkError(message);
            throw new Error(message);
        } finally {
            setIsForkingCatalog(false);
        }
    }, [catalog, catalogId, isSharedEntry]);

    const publishCurrentCatalog = useCallback(
        async (catalogIdOverride?: string): Promise<CatalogResponse> => {
            const targetCatalogId = catalogIdOverride ?? catalogId;

            setPublishError(null);
            setIsPublishingCatalog(true);

            try {
                const publishedCatalog = await publishCatalog(targetCatalogId);
                setCatalog(publishedCatalog);
                setIsCatalogDraftDirty(false);
                return publishedCatalog;
            } catch (err) {
                const message = getPublishErrorMessage(err);
                setPublishError(message);
                throw new Error(message);
            } finally {
                setIsPublishingCatalog(false);
            }
        },
        [catalogId],
    );

    const value = useMemo(
        () => ({
            draft,
            catalog,
            catalogStatus,
            shareSlug,
            isPublished,
            isSharedEntry,
            forkedFromCatalogId,
            isCatalogLoading,
            catalogError,
            isDraftLoading,
            draftError,
            isCatalogDraftDirty,
            isForkingCatalog,
            forkError,
            isPublishingCatalog,
            publishError,
            updateCatalogDraft,
            updateScheduleRequest,
            setGenerationResult,
            resetDraft,
            refreshCatalog,
            refreshDraft,
            markCatalogDraftClean,
            ensureEditableCatalog,
            publishCurrentCatalog,
        }),
        [
            draft,
            catalog,
            catalogStatus,
            shareSlug,
            isPublished,
            isSharedEntry,
            forkedFromCatalogId,
            isCatalogLoading,
            catalogError,
            isDraftLoading,
            draftError,
            isCatalogDraftDirty,
            isForkingCatalog,
            forkError,
            isPublishingCatalog,
            publishError,
            updateCatalogDraft,
            updateScheduleRequest,
            setGenerationResult,
            resetDraft,
            refreshCatalog,
            refreshDraft,
            markCatalogDraftClean,
            ensureEditableCatalog,
            publishCurrentCatalog,
        ],
    );

    return (
        <ScheduleDraftContext.Provider value={value}>
            {children}
        </ScheduleDraftContext.Provider>
    );
}

// Hook

export function useScheduleDraft(): ScheduleDraftContextType {
    const context = useContext(ScheduleDraftContext);
    if (!context) {
        throw new Error(
            "useScheduleDraft must be used within a ScheduleDraftProvider",
        );
    }
    return context;
}
