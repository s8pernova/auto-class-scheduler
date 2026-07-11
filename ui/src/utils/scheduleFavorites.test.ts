import { describe, expect, it } from "vitest";
import type {
    GeneratedScheduleResponse,
    ScheduleSummaryResponse,
} from "@/api";
import {
    getGeneratedScheduleFavoriteKey,
    getSavedScheduleFavoriteKey,
} from "@/utils/scheduleFavorites";

function generatedSchedule(
    resultId: string,
    sectionIds: string[],
): GeneratedScheduleResponse {
    return {
        resultId,
        sections: sectionIds.map((catalogSectionMeetingId) => ({
            catalogSectionId: `course-${catalogSectionMeetingId}`,
            catalogSectionMeetingId,
            courseName: "TEST 1000",
            instructorName: null,
            meetings: [],
            sectionCode: catalogSectionMeetingId,
        })),
        summary: {
            averageInstructorRating: null,
            earliestStart: "09:00:00",
            latestEnd: "10:00:00",
            maxSingleGapMinutes: 0,
            meetingDays: ["M"],
            numMeetingDays: 1,
            ratedInstructorCount: 0,
            totalGapMinutes: 0,
            unratedInstructorCount: sectionIds.length,
        },
    };
}

function savedSchedule(
    scheduleId: number,
    sectionIds: Array<string | null>,
): ScheduleSummaryResponse {
    return {
        campus_pattern: "Unspecified",
        created_at: "2026-07-10T00:00:00Z",
        earliest_start: "09:00:00",
        latest_end: "10:00:00",
        meets_fri: false,
        meets_mon: true,
        meets_sat: false,
        meets_thu: false,
        meets_tue: false,
        meets_wed: false,
        num_sections: sectionIds.length,
        schedule_id: scheduleId,
        sections: sectionIds.map((catalogSectionMeetingId) => ({
            campus: "Unspecified",
            catalog_section_meeting_id: catalogSectionMeetingId,
            credits: 3,
            meetings: [],
        })),
        total_credits: sectionIds.length * 3,
    };
}

describe("schedule favorite keys", () => {
    it("matches generated and saved schedules regardless of section order", () => {
        expect(getGeneratedScheduleFavoriteKey(generatedSchedule("1", ["b", "a"]))).toBe(
            getSavedScheduleFavoriteKey(savedSchedule(42, ["a", "b"])),
        );
    });

    it("rejects saved schedules without complete meeting-row identity", () => {
        expect(getSavedScheduleFavoriteKey(savedSchedule(42, ["a", null]))).toBeNull();
    });

    it("falls back to the result id for empty generated schedules", () => {
        expect(getGeneratedScheduleFavoriteKey(generatedSchedule("fallback", []))).toBe(
            "fallback",
        );
    });
});
