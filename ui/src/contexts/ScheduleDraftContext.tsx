import type { ScheduleGenerateResponse } from "@/api/client";
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

// Types

export interface SectionRef {
    subjectCode: string;
    courseNumber: number;
    days: string;
    time: string;
    crn?: string;
    instructor?: string;
    rating?: string;
}

export interface RequirementCourse {
    id: string;
    label: string;
    minSections: number;
    maxSections: number;
    sections: SectionRef[];
}

export interface BlockedTime {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export interface SchedulePreferences {
    allowFullSections?: boolean;
    allowRestrictedSections?: boolean;
    campuses?: string[];
    times?: string[];
}

export type InstructorRatings = Record<string, number | null>;

export interface ScheduleDraft {
    catalogId: string;
    requirementCourses: RequirementCourse[];
    pinnedCrns: string[];
    excludedCrns: string[];
    blockedTimes: BlockedTime[];
    preferences: SchedulePreferences;
    instructorRatings: InstructorRatings;
    generationResult: ScheduleGenerateResponse | null;
}

interface ScheduleDraftContextType {
    draft: ScheduleDraft;
    updateDraft: (patch: Partial<Omit<ScheduleDraft, "catalogId">>) => void;
    resetDraft: () => void;
}

// Context

const ScheduleDraftContext = createContext<ScheduleDraftContextType | null>(
    null,
);

const GENERATION_INPUT_KEYS = [
    "requirementCourses",
    "pinnedCrns",
    "excludedCrns",
    "blockedTimes",
    "preferences",
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
        pinnedCrns: [],
        excludedCrns: [],
        blockedTimes: [],
        preferences: {},
        instructorRatings: {},
        generationResult: null,
    };
}

// Provider

export function ScheduleDraftProvider({
    catalogId,
    children,
}: {
    catalogId: string;
    children: ReactNode;
}) {
    const [draft, setDraft] = useState<ScheduleDraft>(() =>
        buildInitialDraft(catalogId),
    );

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

    const value = useMemo(
        () => ({ draft, updateDraft, resetDraft }),
        [draft, updateDraft, resetDraft],
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
