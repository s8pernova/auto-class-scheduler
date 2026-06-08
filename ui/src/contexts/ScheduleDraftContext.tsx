import {
    getCatalog,
    getCatalogSections,
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
    updateDraft: (patch: Partial<Omit<ScheduleDraft, "catalogId">>) => void;
    resetDraft: () => void;
    refreshCatalog: () => Promise<void>;
    refreshDraft: () => Promise<void>;
}

// Context

const ScheduleDraftContext = createContext<ScheduleDraftContextType | null>(
    null,
);

const GENERATION_INPUT_KEYS = [
    "requirementCourses",
    "requirementGroups",
    "blockedTimes",
    "instructorRatings",
] as const;

function patchChangesGenerationInputs(
    patch: Partial<Omit<ScheduleDraft, "catalogId">>,
): boolean {
    if (Object.prototype.hasOwnProperty.call(patch, "generationResult")) {
        return false;
    }

    return GENERATION_INPUT_KEYS.some((key) =>
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

function getFirstMeeting(section: CatalogSectionResponse) {
    return [...(section.meetings ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder,
    )[0];
}

function buildDraftFromCatalogSections(
    catalogId: string,
    sections: CatalogSectionResponse[],
): ScheduleDraft {
    const coursesByName = new Map<string, RequirementCourse>();

    const sortedSections = [...sections].sort(
        (left, right) => left.sortOrder - right.sortOrder,
    );

    for (const section of sortedSections) {
        const label = section.courseName.trim();
        let course = coursesByName.get(label);

        if (!course) {
            const id = `course-${slugifyCourseId(label)}-${coursesByName.size}`;
            course = {
                id,
                label,
                sections: [],
            };
            coursesByName.set(label, course);
        }

        const meeting = getFirstMeeting(section);

        course.sections.push({
            days: meeting?.days ?? "",
            time: meeting
                ? `${formatMeetingTime(meeting.startTime)}-${formatMeetingTime(
                      meeting.endTime,
                  )}`
                : "",
            crn: section.crn ?? "",
            instructor: section.instructorName ?? "",
        });
    }

    const requirementCourses = [...coursesByName.values()];

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
    entryShareSlug?: string;
    isSharedEntry?: boolean;
}

function isMatchingEntryCatalog(
    catalogId: string,
    catalog: CatalogResponse | undefined,
): catalog is CatalogResponse {
    return catalog?.id === catalogId;
}

function getCatalogErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : "Failed to fetch catalog.";
}

function getDraftErrorMessage(err: unknown): string {
    return err instanceof Error
        ? err.message
        : "Failed to fetch catalog sections.";
}

export function ScheduleDraftProvider({
    catalogId,
    children,
    entryCatalog,
    entryShareSlug,
    isSharedEntry = false,
}: ScheduleDraftProviderProps) {
    const initialCatalog = isMatchingEntryCatalog(catalogId, entryCatalog)
        ? entryCatalog
        : null;
    const [draft, setDraft] = useState<ScheduleDraft>(() =>
        buildInitialDraft(catalogId),
    );
    const [catalog, setCatalog] = useState<CatalogResponse | null>(
        initialCatalog,
    );
    const [isCatalogLoading, setIsCatalogLoading] = useState(
        initialCatalog === null,
    );
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [isDraftLoading, setIsDraftLoading] = useState(true);
    const [draftError, setDraftError] = useState<string | null>(null);

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

        setDraft(buildInitialDraft(catalogId));
        setCatalog(seededCatalog);
        setCatalogError(null);
        setDraftError(null);

        setIsDraftLoading(true);
        getCatalogSections(catalogId)
            .then((sections) => {
                if (!isCurrent) return;
                setDraft(buildDraftFromCatalogSections(catalogId, sections));
            })
            .catch((err) => {
                if (!isCurrent) return;
                setDraftError(getDraftErrorMessage(err));
            })
            .finally(() => {
                if (!isCurrent) return;
                setIsDraftLoading(false);
            });

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
    }, [catalogId, entryCatalog]);

    const updateDraft = useCallback(
        (patch: Partial<Omit<ScheduleDraft, "catalogId">>) => {
            setDraft((prev) => {
                const hasGenerationResultPatch =
                    Object.prototype.hasOwnProperty.call(
                        patch,
                        "generationResult",
                    );

                return {
                    ...prev,
                    ...patch,
                    generationResult: patchChangesGenerationInputs(patch)
                        ? null
                        : hasGenerationResultPatch
                          ? (patch.generationResult ?? null)
                          : prev.generationResult,
                };
            });
        },
        [],
    );

    const resetDraft = useCallback(() => {
        setDraft(buildInitialDraft(catalogId));
    }, [catalogId]);

    const catalogStatus = catalog?.status ?? null;
    const shareSlug = catalog?.share_slug ?? entryShareSlug ?? null;
    const forkedFromCatalogId = catalog?.forked_from_catalog_id ?? null;
    const isPublished = catalogStatus === "published";

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
            updateDraft,
            resetDraft,
            refreshCatalog,
            refreshDraft,
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
            updateDraft,
            resetDraft,
            refreshCatalog,
            refreshDraft,
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
