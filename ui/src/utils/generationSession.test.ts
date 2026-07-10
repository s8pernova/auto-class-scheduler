import { describe, expect, it } from "vitest";
import type { ScheduleGenerationSessionResponse } from "@/api";
import { ApiError } from "@/api/errors";
import {
    buildDefaultGenerationView,
    buildGenerationSessionQueryRequest,
    getGenerationSessionErrorMessage,
    isGenerationSessionExpiredError,
    mergeGenerationSessionPages,
    withGenerationBlockedTimes,
} from "@/utils/generationSession";

describe("generation session view state", () => {
    it("retains filters, sort, and page size when builder blocked times change", () => {
        const view = buildDefaultGenerationView();
        view.filters.excludedDays = ["F"];
        view.filters.maxMeetingDays = 4;
        view.sort = { field: "latestEnd", direction: "desc" };
        view.pageLimit = 100;

        const updated = withGenerationBlockedTimes(view, [
            { dayOfWeek: "M", startTime: "09:00", endTime: "10:00" },
        ]);

        expect(updated.filters.blockedTimes).toEqual([
            { days: "M", startTime: "09:00", endTime: "10:00" },
        ]);
        expect(updated.filters.excludedDays).toEqual(["F"]);
        expect(updated.filters.maxMeetingDays).toBe(4);
        expect(updated.sort).toEqual(view.sort);
        expect(updated.pageLimit).toBe(100);
    });

    it("constructs a cursor query from the retained view", () => {
        const view = buildDefaultGenerationView();
        const request = buildGenerationSessionQueryRequest(view, "next-page");

        expect(request.filters).toEqual(view.filters);
        expect(request.sort).toEqual(view.sort);
        expect(request.page).toEqual({ cursor: "next-page", limit: 50 });
    });
});

describe("generation session pagination", () => {
    it("appends a page while preserving authoritative counts and next cursor", () => {
        const first = response("session-one", "result-one", "cursor-two", 1);
        const second = response("session-one", "result-two", null, 1);

        const merged = mergeGenerationSessionPages(first, second);

        expect(merged.schedules.map((schedule) => schedule.resultId)).toEqual([
            "result-one",
            "result-two",
        ]);
        expect(merged.returnedCount).toBe(2);
        expect(merged.generatedCount).toBe(2);
        expect(merged.filteredCount).toBe(2);
        expect(merged.nextCursor).toBeNull();
    });

    it("refuses to combine pages from different sessions", () => {
        expect(() =>
            mergeGenerationSessionPages(
                response("session-one", "result-one", null, 1),
                response("session-two", "result-two", null, 1),
            ),
        ).toThrow("different generation sessions");
    });
});

describe("generation session expiration", () => {
    it("recognizes the typed API condition and provides recovery messaging", () => {
        const error = new ApiError("expired", {
            status: 410,
            code: "generation_session_expired",
        });

        expect(isGenerationSessionExpiredError(error)).toBe(true);
        expect(getGenerationSessionErrorMessage(error, "fallback")).toContain(
            "Regenerate",
        );
    });
});

function response(
    sessionId: string,
    resultId: string,
    nextCursor: string | null,
    returnedCount: number,
): ScheduleGenerationSessionResponse {
    return {
        sessionId,
        expiresAt: "2099-01-01T00:00:00Z",
        candidateCount: 2,
        generatedCount: 2,
        filteredCount: 2,
        returnedCount,
        nextCursor,
        schedules: [
            {
                resultId,
                summary: {
                    meetingDays: ["M"],
                    numMeetingDays: 1,
                    earliestStart: "09:00:00",
                    latestEnd: "10:00:00",
                    totalGapMinutes: 0,
                    maxSingleGapMinutes: 0,
                    averageInstructorRating: 4.5,
                    ratedInstructorCount: 1,
                    unratedInstructorCount: 0,
                },
                sections: [],
            },
        ],
    };
}
