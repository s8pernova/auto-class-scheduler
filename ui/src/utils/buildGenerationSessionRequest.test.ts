import { describe, expect, it } from "vitest";
import type { ScheduleDraft } from "@/contexts/ScheduleDraftContext";
import { buildGenerationSessionRequest } from "@/utils/buildGenerationSessionRequest";
import { buildDefaultGenerationView } from "@/utils/generationSession";

describe("buildGenerationSessionRequest", () => {
    it("builds the authoritative session contract from retained draft state", () => {
        const generationView = buildDefaultGenerationView([
            {
                dayOfWeek: "MW",
                startTime: "12:00",
                endTime: "13:00",
            },
        ]);
        generationView.filters.excludedDays = ["F"];
        generationView.sort = {
            field: "totalGapMinutes",
            direction: "asc",
        };
        generationView.pageLimit = 25;

        const draft: ScheduleDraft = {
            catalogId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            requirementCourses: [
                {
                    id: "math",
                    label: "MATH 101",
                    sections: [
                        {
                            days: "M",
                            time: "09:00-10:00",
                            instructor: "Professor Example",
                        },
                    ],
                },
            ],
            requirementGroups: [
                {
                    id: "math-group",
                    courseIds: ["math"],
                    choose: 1,
                },
            ],
            blockedTimes: [],
            instructorRatings: { "Professor Example": 4.5 },
            generationView,
            generationResult: null,
        };

        const request = buildGenerationSessionRequest(draft);

        expect(request).toEqual({
            metadata: { catalogId: draft.catalogId },
            requirements: {
                groups: [
                    {
                        name: undefined,
                        courseNames: ["MATH 101"],
                        choose: 1,
                    },
                ],
            },
            filters: generationView.filters,
            instructorRatings: draft.instructorRatings,
            sort: generationView.sort,
            page: { limit: 25 },
        });
        expect(request).not.toHaveProperty("preferences");
        expect(request).not.toHaveProperty("maxResults");
    });
});
