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

export interface ScheduleDraft {
    catalogId: string;
    requirementCourses: RequirementCourse[];
    pinnedCrns: string[];
    excludedCrns: string[];
    blockedTimes: BlockedTime[];
    preferences: SchedulePreferences;
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

function buildInitialDraft(catalogId: string): ScheduleDraft {
    return {
        catalogId,
        requirementCourses: [],
        pinnedCrns: [],
        excludedCrns: [],
        blockedTimes: [],
        preferences: {},
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
            setDraft((prev) => ({ ...prev, ...patch }));
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
