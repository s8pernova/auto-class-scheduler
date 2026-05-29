export function parseCourseInput(rawInput: string): string | null {
    const normalized = rawInput.trim().replace(/\s+/g, " ");
    return normalized || null;
}
