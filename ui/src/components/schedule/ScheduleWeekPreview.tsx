import type {
    GeneratedScheduleResponse,
    ScheduleGenerateBlockedTimeInput,
} from "@/api";
import { formatTime } from "@/utils/scheduleResults";

type ScheduleWeekPreviewProps = {
    schedule: GeneratedScheduleResponse;
    blockedTimes?: ScheduleGenerateBlockedTimeInput[];
};

type DayCode = "M" | "T" | "W" | "R" | "F" | "S";

type CalendarBlock = {
    id: string;
    day: DayCode;
    startMinutes: number;
    endMinutes: number;
    title: string;
    subtitle: string;
    kind: "meeting" | "blocked";
};

const DAY_COLUMNS: { code: DayCode; label: string }[] = [
    { code: "M", label: "Mon" },
    { code: "T", label: "Tue" },
    { code: "W", label: "Wed" },
    { code: "R", label: "Thu" },
    { code: "F", label: "Fri" },
    { code: "S", label: "Sat" },
];

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const HOUR_HEIGHT_PX = 42;
const MIN_BLOCK_HEIGHT_PX = 18;

function parseTimeMinutes(value: string): number | null {
    const [hoursText, minutesText = "0"] = value.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    return hours * 60 + minutes;
}

function expandDays(value: string): DayCode[] {
    const allowedDays = new Set<DayCode>(DAY_COLUMNS.map((day) => day.code));
    return Array.from(value.toUpperCase()).filter((day): day is DayCode =>
        allowedDays.has(day as DayCode),
    );
}

function buildMeetingBlocks(schedule: GeneratedScheduleResponse): CalendarBlock[] {
    return schedule.sections.flatMap((section) =>
        section.meetings.flatMap((meeting) => {
            const startMinutes = parseTimeMinutes(meeting.startTime);
            const endMinutes = parseTimeMinutes(meeting.endTime);

            if (
                startMinutes === null ||
                endMinutes === null ||
                endMinutes <= startMinutes
            ) {
                return [];
            }

            return expandDays(meeting.dayOfWeek).map((day) => ({
                id: `meeting-${section.catalogSectionMeetingId}-${day}-${meeting.startTime}-${meeting.endTime}`,
                day,
                startMinutes,
                endMinutes,
                title: `${section.courseName} ${section.sectionCode}`,
                subtitle: `${formatTime(meeting.startTime)} - ${formatTime(
                    meeting.endTime,
                )}`,
                kind: "meeting" as const,
            }));
        }),
    );
}

function buildBlockedTimeBlocks(
    blockedTimes: ScheduleGenerateBlockedTimeInput[] = [],
): CalendarBlock[] {
    return blockedTimes.flatMap((blockedTime, index) => {
        const startMinutes = parseTimeMinutes(blockedTime.startTime);
        const endMinutes = parseTimeMinutes(blockedTime.endTime);

        if (
            startMinutes === null ||
            endMinutes === null ||
            endMinutes <= startMinutes
        ) {
            return [];
        }

        return expandDays(blockedTime.days).map((day) => ({
            id: `blocked-${index}-${day}-${blockedTime.startTime}-${blockedTime.endTime}`,
            day,
            startMinutes,
            endMinutes,
            title: "Blocked",
            subtitle: `${formatTime(blockedTime.startTime)} - ${formatTime(
                blockedTime.endTime,
            )}`,
            kind: "blocked" as const,
        }));
    });
}

function buildHourTicks(startHour: number, endHour: number): number[] {
    return Array.from(
        { length: endHour - startHour + 1 },
        (_, index) => startHour + index,
    );
}

function hourLabel(hour: number): string {
    return formatTime(`${String(hour).padStart(2, "0")}:00`);
}

export default function ScheduleWeekPreview({
    schedule,
    blockedTimes = [],
}: ScheduleWeekPreviewProps) {
    const meetingBlocks = buildMeetingBlocks(schedule);
    const blockedTimeBlocks = buildBlockedTimeBlocks(blockedTimes);
    const blocks = [...blockedTimeBlocks, ...meetingBlocks];
    const minBlockStart = Math.min(
        ...blocks.map((block) => block.startMinutes),
        DEFAULT_START_HOUR * 60,
    );
    const maxBlockEnd = Math.max(
        ...blocks.map((block) => block.endMinutes),
        DEFAULT_END_HOUR * 60,
    );
    const startHour = Math.max(0, Math.floor(minBlockStart / 60));
    const endHour = Math.min(24, Math.ceil(maxBlockEnd / 60));
    const startMinutes = startHour * 60;
    const totalMinutes = Math.max(60, (endHour - startHour) * 60);
    const gridHeight = Math.max(220, (totalMinutes / 60) * HOUR_HEIGHT_PX);
    const hourTicks = buildHourTicks(startHour, endHour);

    return (
        <section aria-label="Weekly schedule preview" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-background">
                    Week preview
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-background/55">
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-accent" />
                        Class
                    </span>
                    {blockedTimeBlocks.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm border border-background/25 bg-background/10" />
                            Blocked
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="overflow-hidden rounded-md border border-background/10 bg-background/[0.03]">
                <div className="grid grid-cols-[34px_repeat(6,minmax(0,1fr))] border-b border-background/10 text-[10px] font-semibold uppercase tracking-wide text-background/55">
                    <div />
                    {DAY_COLUMNS.map((day) => (
                        <div
                            key={day.code}
                            className="border-l border-background/10 px-1 py-1.5 text-center"
                        >
                            {day.label}
                        </div>
                    ))}
                </div>

                <div
                    className="grid grid-cols-[34px_repeat(6,minmax(0,1fr))]"
                    style={{ height: `${gridHeight}px` }}
                >
                    <div className="relative border-r border-background/10">
                        {hourTicks.map((hour) => (
                            <div
                                key={hour}
                                className="absolute right-1 -translate-y-1/2 text-[9px] text-background/45"
                                style={{
                                    top: `${((hour * 60 - startMinutes) / totalMinutes) * 100}%`,
                                }}
                            >
                                {hourLabel(hour)}
                            </div>
                        ))}
                    </div>

                    {DAY_COLUMNS.map((day) => {
                        const dayBlocks = blocks.filter(
                            (block) => block.day === day.code,
                        );

                        return (
                            <div
                                key={day.code}
                                className="relative border-l border-background/10"
                            >
                                {hourTicks.slice(1).map((hour) => (
                                    <div
                                        key={hour}
                                        className="absolute left-0 right-0 border-t border-background/10"
                                        style={{
                                            top: `${((hour * 60 - startMinutes) / totalMinutes) * 100}%`,
                                        }}
                                    />
                                ))}

                                {dayBlocks.map((block) => {
                                    const top =
                                        ((block.startMinutes - startMinutes) /
                                            totalMinutes) *
                                        100;
                                    const height = Math.max(
                                        MIN_BLOCK_HEIGHT_PX,
                                        ((block.endMinutes -
                                            block.startMinutes) /
                                            totalMinutes) *
                                            gridHeight,
                                    );

                                    return (
                                        <div
                                            key={block.id}
                                            title={`${block.title}: ${block.subtitle}`}
                                            className={`absolute left-0.5 right-0.5 overflow-hidden rounded px-1 py-0.5 leading-tight ${
                                                block.kind === "meeting"
                                                    ? "bg-accent text-white shadow-sm"
                                                    : "border border-background/20 bg-background/10 text-background/55"
                                            }`}
                                            style={{
                                                top: `${top}%`,
                                                height: `${height}px`,
                                            }}
                                        >
                                            <p className="truncate text-[10px] font-semibold">
                                                {block.title}
                                            </p>
                                            <p className="truncate text-[9px] opacity-80">
                                                {block.subtitle}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
