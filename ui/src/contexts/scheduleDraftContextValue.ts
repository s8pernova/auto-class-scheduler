import { createContext } from "react";
import type { ScheduleDraftContextType } from "@/contexts/ScheduleDraftContext";

export const ScheduleDraftContext =
    createContext<ScheduleDraftContextType | null>(null);
