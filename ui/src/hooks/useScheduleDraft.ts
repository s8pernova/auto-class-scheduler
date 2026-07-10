import { useContext } from "react";
import { ScheduleDraftContext } from "@/contexts/scheduleDraftContextValue";
import type { ScheduleDraftContextType } from "@/contexts/ScheduleDraftContext";

export function useScheduleDraft(): ScheduleDraftContextType {
    const context = useContext(ScheduleDraftContext);
    if (!context) {
        throw new Error(
            "useScheduleDraft must be used within a ScheduleDraftProvider",
        );
    }
    return context;
}
