import type {
    GeneratedScheduleResponse,
    ScheduleSummaryResponse,
} from "@/api";

export function getGeneratedScheduleFavoriteKey(
    schedule: GeneratedScheduleResponse,
): string {
    const sectionRowIds = schedule.sections
        .map((section) => section.catalogSectionMeetingId)
        .sort();

    return sectionRowIds.length > 0
        ? sectionRowIds.join("|")
        : schedule.resultId;
}

export function getSavedScheduleFavoriteKey(
    schedule: ScheduleSummaryResponse,
): string | null {
    const sections = schedule.sections ?? [];
    const sectionRowIds = sections
        .map((section) => section.catalog_section_meeting_id)
        .filter((id): id is string => id != null)
        .sort();

    if (sectionRowIds.length === 0 || sectionRowIds.length !== sections.length) {
        return null;
    }

    return sectionRowIds.join("|");
}

export function filterGeneratedSchedulesByFavorites(
    schedules: GeneratedScheduleResponse[],
    favoriteKeys: ReadonlySet<string>,
): GeneratedScheduleResponse[] {
    return schedules.filter((schedule) =>
        favoriteKeys.has(getGeneratedScheduleFavoriteKey(schedule)),
    );
}
