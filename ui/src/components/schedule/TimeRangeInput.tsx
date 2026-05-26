// Converts "10:00AM" or "1:30PM" to 24h "HH:MM" for <input type="time">
function to24h(raw: string): string {
    const match = raw
        .trim()
        .toUpperCase()
        .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

    if (!match) return "";

    let hours = Number.parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3];

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    return `${String(hours).padStart(2, "0")}:${minutes}`;
}

// Converts 24h "HH:MM" back to "10:00AM" display format
function to12h(time24: string): string {
    const [rawHours, minutes] = time24.split(":");

    if (!rawHours || !minutes) return "";

    let hours = Number.parseInt(rawHours, 10);
    const period = hours >= 12 ? "PM" : "AM";

    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;

    return `${hours}:${minutes}${period}`;
}

// Parses "10:00AM-11:00AM" into [start24h, end24h]
function parseTimeRange(value: string): [string, string] {
    if (!value || !value.includes("-")) return ["", ""];

    const [startRaw, endRaw] = value.split("-");
    return [to24h(startRaw), to24h(endRaw)];
}

// Composes [start24h, end24h] back into "10:00AM-11:00AM"
function formatTimeRange(start24: string, end24: string): string {
    if (!start24 && !end24) return "";
    if (!start24) return to12h(end24);
    if (!end24) return to12h(start24);
    return `${to12h(start24)}-${to12h(end24)}`;
}

type TimeRangeInputProps = {
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

export function TimeRangeInput({
    value,
    onChange,
    className = "",
}: TimeRangeInputProps) {
    const [start, end] = parseTimeRange(value);

    function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
        onChange(formatTimeRange(e.target.value, end));
    }

    function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
        onChange(formatTimeRange(start, e.target.value));
    }

    const inputClass =
        "bg-transparent outline-none border border-transparent rounded px-2 py-1 focus:border-accent hover:border-background/20 text-sm";

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <input
                type="time"
                value={start}
                onChange={handleStartChange}
                className={inputClass}
                aria-label="Start time"
            />
            <span className="text-background/40 text-xs">-</span>
            <input
                type="time"
                value={end}
                onChange={handleEndChange}
                className={inputClass}
                aria-label="End time"
            />
        </div>
    );
}
