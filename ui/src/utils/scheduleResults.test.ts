import { describe, expect, it } from "vitest";
import {
    formatMeetingDay,
    normalizeMeetingDay,
    normalizeMeetingDayCodes,
} from "@/utils/scheduleResults";

describe("meeting day normalization", () => {
    it.each([
        ["M", "M"],
        ["Mon", "M"],
        ["Monday", "M"],
        ["R", "R"],
        ["Thu", "R"],
        ["Thursday", "R"],
    ] as const)("normalizes %s to %s", (value, expected) => {
        expect(normalizeMeetingDay(value)).toBe(expected);
    });

    it("rejects unsupported meeting days", () => {
        expect(normalizeMeetingDay("Sunday")).toBeNull();
    });

    it("normalizes compact multi-day values in canonical order", () => {
        expect(normalizeMeetingDayCodes("R M R W")).toEqual(["M", "W", "R"]);
    });

    it("formats API day names from the shared metadata", () => {
        expect(formatMeetingDay("Thu")).toBe("Thursday");
    });
});
