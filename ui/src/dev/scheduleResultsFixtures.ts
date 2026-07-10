// Use /catalogs/dev-catalog/results?fixture=generated-results

import type {
    GeneratedMeetingResponse,
    GeneratedScheduleResponse,
    GeneratedSectionResponse,
    ScheduleGenerationSessionResponse,
} from "@/api";
import {
    type RequirementCourse,
    type RequirementGroup,
    type ScheduleDraft,
    type SectionRef,
} from "@/contexts/ScheduleDraftContext";
import {
    buildDefaultGenerationView,
    type GenerationViewState,
} from "@/utils/generationSession";

function draftSection(
    days: string,
    time: string,
    crn: string,
    instructor: string,
): SectionRef {
    return {
        days,
        time,
        crn,
        instructor,
    };
}

const COURSES: RequirementCourse[] = [
    {
        id: "req-cs-2104",
        label: "CS 2104",
        sections: [
            draftSection("MWF", "08:00-08:50", "21041", "Avery Chen"),
            draftSection("TR", "12:30-13:45", "21042", "Sam Rivera"),
            draftSection("M", "17:30-18:45", "21043", "Avery Chen"),
            draftSection("S", "09:00-11:30", "21044", "Instructor TBD"),
            draftSection("TR", "09:30-10:45", "21045", "Sam Rivera"),
        ],
    },
    {
        id: "req-math-2114",
        label: "MATH 2114",
        sections: [
            draftSection("MW", "10:00-11:15", "21141", "Mina Patel"),
            draftSection("TR", "14:00-15:15", "21142", "Mina Patel"),
            draftSection("W", "19:30-20:45", "21143", "Theo Brooks"),
            draftSection("F", "12:20-13:20", "21144", "Theo Brooks"),
            draftSection("MW", "15:30-16:45", "21145", "Mina Patel"),
        ],
    },
    {
        id: "req-stat-3005",
        label: "STAT 3005",
        sections: [
            draftSection("F", "09:05-09:55", "30051", "Jordan Lee"),
            draftSection("R", "09:30-10:45", "30052", "Noor Hassan"),
            draftSection("F", "18:00-19:15", "30053", "Jordan Lee"),
            draftSection("F", "10:10-11:00", "30054", "Noor Hassan"),
            draftSection("R", "12:30-13:45", "30055", "Jordan Lee"),
        ],
    },
];

const REQUIREMENT_GROUPS: RequirementGroup[] = COURSES.map((course) => ({
    id: `group-${course.id}`,
    courseIds: [course.id],
    choose: 1,
}));

function meeting(
    dayOfWeek: string,
    startTime: string,
    endTime: string,
): GeneratedMeetingResponse {
    return { dayOfWeek, startTime, endTime };
}

function bucketId(courseName: string): string {
    return `bucket-${courseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function section(
    id: string,
    courseName: string,
    sectionCode: string,
    instructorName: string,
    meetings: GeneratedMeetingResponse[],
): GeneratedSectionResponse {
    return {
        catalogSectionId: bucketId(courseName),
        catalogSectionMeetingId: id,
        courseName,
        sectionCode,
        instructorName,
        meetings,
    };
}

function schedule(
    resultId: string,
    earliestStart: string,
    latestEnd: string,
    totalInstructorScore: number | null,
    sections: GeneratedSectionResponse[],
    days: Partial<Record<"meetsMon" | "meetsTue" | "meetsWed" | "meetsThu" | "meetsFri" | "meetsSat", boolean>>,
): GeneratedScheduleResponse {
    const meetingDays = [
        ["M", days.meetsMon],
        ["T", days.meetsTue],
        ["W", days.meetsWed],
        ["R", days.meetsThu],
        ["F", days.meetsFri],
        ["S", days.meetsSat],
    ].flatMap(([day, meets]) => (meets ? [day as string] : []));

    return {
        resultId,
        summary: {
            meetingDays,
            numMeetingDays: meetingDays.length,
            earliestStart,
            latestEnd,
            totalGapMinutes: 0,
            maxSingleGapMinutes: 0,
            averageInstructorRating: totalInstructorScore,
            ratedInstructorCount:
                totalInstructorScore == null ? 0 : sections.length,
            unratedInstructorCount:
                totalInstructorScore == null ? sections.length : 0,
        },
        sections,
    };
}

const GENERATED_RESULTS: ScheduleGenerationSessionResponse = {
    sessionId: "schedgen_fixture_generated_results",
    expiresAt: "2099-01-01T00:00:00Z",
    candidateCount: 18,
    generatedCount: 5,
    filteredCount: 5,
    returnedCount: 5,
    nextCursor: null,
    schedules: [
        schedule(
            "fixture-early-mwf",
            "08:00:00",
            "11:15:00",
            4.6,
            [
                section(
                    "11111111-1111-4111-8111-111111111111",
                    "CS 2104",
                    "A01",
                    "Avery Chen",
                    [
                        meeting("Mon", "08:00:00", "08:50:00"),
                        meeting("Wed", "08:00:00", "08:50:00"),
                        meeting("Fri", "08:00:00", "08:50:00"),
                    ],
                ),
                section(
                    "22222222-2222-4222-8222-222222222222",
                    "MATH 2114",
                    "B03",
                    "Mina Patel",
                    [
                        meeting("Mon", "10:00:00", "11:15:00"),
                        meeting("Wed", "10:00:00", "11:15:00"),
                    ],
                ),
                section(
                    "33333333-3333-4333-8333-333333333333",
                    "STAT 3005",
                    "C02",
                    "Jordan Lee",
                    [meeting("Fri", "09:05:00", "09:55:00")],
                ),
            ],
            { meetsMon: true, meetsWed: true, meetsFri: true },
        ),
        schedule(
            "fixture-tuth-compact",
            "12:30:00",
            "15:15:00",
            4.9,
            [
                section(
                    "44444444-4444-4444-8444-444444444444",
                    "CS 2104",
                    "A02",
                    "Sam Rivera",
                    [
                        meeting("Tue", "12:30:00", "13:45:00"),
                        meeting("Thu", "12:30:00", "13:45:00"),
                    ],
                ),
                section(
                    "55555555-5555-4555-8555-555555555555",
                    "MATH 2114",
                    "B01",
                    "Mina Patel",
                    [
                        meeting("Tue", "14:00:00", "15:15:00"),
                        meeting("Thu", "14:00:00", "15:15:00"),
                    ],
                ),
                section(
                    "66666666-6666-4666-8666-666666666666",
                    "STAT 3005",
                    "C01",
                    "Noor Hassan",
                    [meeting("Thu", "09:30:00", "10:45:00")],
                ),
            ],
            { meetsTue: true, meetsThu: true },
        ),
        schedule(
            "fixture-evening",
            "17:30:00",
            "20:45:00",
            3.8,
            [
                section(
                    "77777777-7777-4777-8777-777777777777",
                    "CS 2104",
                    "E01",
                    "Avery Chen",
                    [meeting("Mon", "17:30:00", "18:45:00")],
                ),
                section(
                    "88888888-8888-4888-8888-888888888888",
                    "MATH 2114",
                    "E02",
                    "Theo Brooks",
                    [meeting("Wed", "19:30:00", "20:45:00")],
                ),
                section(
                    "99999999-9999-4999-8999-999999999999",
                    "STAT 3005",
                    "E01",
                    "Jordan Lee",
                    [meeting("Fri", "18:00:00", "19:15:00")],
                ),
            ],
            { meetsMon: true, meetsWed: true, meetsFri: true },
        ),
        schedule(
            "fixture-friday-saturday",
            "09:00:00",
            "13:20:00",
            null,
            [
                section(
                    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    "CS 2104",
                    "W01",
                    "Instructor TBD",
                    [meeting("Sat", "09:00:00", "11:30:00")],
                ),
                section(
                    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    "MATH 2114",
                    "F01",
                    "Theo Brooks",
                    [meeting("Fri", "12:20:00", "13:20:00")],
                ),
                section(
                    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    "STAT 3005",
                    "F02",
                    "Noor Hassan",
                    [meeting("Fri", "10:10:00", "11:00:00")],
                ),
            ],
            { meetsFri: true, meetsSat: true },
        ),
        schedule(
            "fixture-balanced",
            "09:30:00",
            "16:45:00",
            4.2,
            [
                section(
                    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                    "CS 2104",
                    "B04",
                    "Sam Rivera",
                    [
                        meeting("Tue", "09:30:00", "10:45:00"),
                        meeting("Thu", "09:30:00", "10:45:00"),
                    ],
                ),
                section(
                    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                    "MATH 2114",
                    "B05",
                    "Mina Patel",
                    [
                        meeting("Mon", "15:30:00", "16:45:00"),
                        meeting("Wed", "15:30:00", "16:45:00"),
                    ],
                ),
                section(
                    "ffffffff-ffff-4fff-8fff-ffffffffffff",
                    "STAT 3005",
                    "C07",
                    "Jordan Lee",
                    [meeting("Thu", "12:30:00", "13:45:00")],
                ),
            ],
            { meetsMon: true, meetsTue: true, meetsWed: true, meetsThu: true },
        ),
    ],
};

export function getScheduleResultsDevFixture(
    fixtureName: string | null,
    catalogId: string,
): ScheduleDraft | null {
    if (fixtureName !== "generated-results") {
        return null;
    }

    const generationView: GenerationViewState = buildDefaultGenerationView();

    return {
        catalogId,
        requirementCourses: COURSES,
        requirementGroups: REQUIREMENT_GROUPS,
        blockedTimes: [],
        instructorRatings: {
            "Avery Chen": 5,
            "Mina Patel": 4,
            "Noor Hassan": 5,
        },
        generationView,
        generationResult: GENERATED_RESULTS,
    };
}
