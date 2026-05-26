import { TbArrowNarrowRightDashed } from "react-icons/tb";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

const DISPLAY_TIME_FORMAT = "h:mmA";
const INPUT_TIME_FORMAT = "HH:mm";

function parseDisplayTime(raw: string): string {
    const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
    const parsed = dayjs(normalized, DISPLAY_TIME_FORMAT, true);

    return parsed.isValid() ? parsed.format(INPUT_TIME_FORMAT) : "";
}

function formatDisplayTime(time24: string): string {
    const parsed = dayjs(time24, INPUT_TIME_FORMAT, true);

    return parsed.isValid() ? parsed.format(DISPLAY_TIME_FORMAT) : "";
}

// Parses "10:00AM-11:00AM" into [start24h, end24h]
function parseTimeRange(value: string): [string, string] {
    if (!value || !value.includes("-")) return ["", ""];

    const [startRaw, endRaw] = value.split("-");
    return [parseDisplayTime(startRaw), parseDisplayTime(endRaw)];
}

// Composes [start24h, end24h] back into "10:00AM-11:00AM"
function formatTimeRange(start24: string, end24: string): string {
    if (!start24 && !end24) return "";
    if (!start24) return formatDisplayTime(end24);
    if (!end24) return formatDisplayTime(start24);
    return `${formatDisplayTime(start24)}-${formatDisplayTime(end24)}`;
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
            <TbArrowNarrowRightDashed />
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
