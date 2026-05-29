import type { SectionRef } from "@/contexts/ScheduleDraftContext";

export function parseCourseInput(rawInput: string): SectionRef | null {
    const match = rawInput.trim().match(/^([a-zA-Z]+)\s*(\d+)$/);

    if (!match) {
        return null;
    }

    return {
        subjectCode: match[1].toUpperCase(),
        courseNumber: Number.parseInt(match[2], 10),
        days: "",
        time: "",
    } satisfies SectionRef;
}
