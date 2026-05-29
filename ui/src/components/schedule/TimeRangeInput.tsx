import TimePicker from "react-time-picker";
import "react-time-picker/dist/TimePicker.css";

type TimeRangeInputProps = {
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

function normalizeTimeValue(raw: string): string {
    const trimmed = raw.trim();
    const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

    if (time24Match) {
        return `${time24Match[1].padStart(2, "0")}:${time24Match[2]}`;
    }

    const time12Match = trimmed
        .toUpperCase()
        .replace(/\s+/g, "")
        .match(/^(\d{1,2}):(\d{2})(AM|PM)$/);

    if (!time12Match) return "";

    let hours = Number.parseInt(time12Match[1], 10);
    const minutes = time12Match[2];
    const period = time12Match[3];

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function parseTimeRange(value: string): [string, string] {
    if (!value) return ["", ""];

    const parts = value.split("-");
    const startRaw = parts[0] || "";
    const endRaw = parts[1] || "";
    
    return [normalizeTimeValue(startRaw), normalizeTimeValue(endRaw)];
}

function formatTimeRange(start: string, end: string): string {
    if (!start && !end) return "";
    return `${start}-${end}`;
}

export function TimeRangeInput({
    value,
    onChange,
    className = "",
}: TimeRangeInputProps) {
    const [start, end] = parseTimeRange(value);

    function handleStartChange(nextValue: string | null) {
        onChange(formatTimeRange(nextValue ?? "", end));
    }

    function handleEndChange(nextValue: string | null) {
        onChange(formatTimeRange(start, nextValue ?? ""));
    }

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <TimePicker
                value={start}
                onChange={handleStartChange}
                disableClock
                clearIcon={null}
                clockIcon={null}
                format="h:mm a"
                maxDetail="minute"
                locale="en-US"
                className="section-time-picker"
                hourAriaLabel="Start hour"
                minuteAriaLabel="Start minute"
                amPmAriaLabel="Start period"
                nativeInputAriaLabel="Start time"
            />
            <span className="text-background/40 text-xs">-</span>
            <TimePicker
                value={end}
                onChange={handleEndChange}
                disableClock
                clearIcon={null}
                clockIcon={null}
                format="h:mm a"
                maxDetail="minute"
                locale="en-US"
                className="section-time-picker"
                hourAriaLabel="End hour"
                minuteAriaLabel="End minute"
                amPmAriaLabel="End period"
                nativeInputAriaLabel="End time"
            />
        </div>
    );
}
