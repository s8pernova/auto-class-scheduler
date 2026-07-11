import type { ScheduleSummaryResponse } from "@/api";
import { formatMeetingDay, formatTime } from "@/utils/scheduleResults";

type SavedScheduleDetailsPanelProps = {
    schedules: ScheduleSummaryResponse[];
    selectedSchedule: ScheduleSummaryResponse | null;
    isLoading: boolean;
    error: string | null;
    onBack: () => void;
};

export default function SavedScheduleDetailsPanel({
    schedules,
    selectedSchedule,
    isLoading,
    error,
    onBack,
}: SavedScheduleDetailsPanelProps) {
    return (
        <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-1">
                Favorite Details
            </h2>
            <div className="min-h-0 overflow-y-auto space-y-4">
                <div className="text-sm text-background/70 space-y-2">
                    <p>{schedules.length} favorite schedules</p>
                    {isLoading ? <p>Loading favorites</p> : null}
                    {error ? <p className="text-red-600">{error}</p> : null}
                </div>

                {selectedSchedule ? (
                    <div className="border-t border-background/10 pt-4">
                        <h3 className="font-semibold text-background mb-2">
                            Schedule {selectedSchedule.schedule_id}
                        </h3>
                        <div className="text-sm text-background/70 space-y-1 mb-4">
                            <p>
                                {formatTime(selectedSchedule.earliest_start)} -{" "}
                                {formatTime(selectedSchedule.latest_end)}
                            </p>
                            <p>
                                {selectedSchedule.total_credits} credits;{" "}
                                {selectedSchedule.num_sections} sections
                            </p>
                            <p>{selectedSchedule.campus_pattern}</p>
                            {selectedSchedule.total_instructor_score != null ? (
                                <p>
                                    Instructor score{" "}
                                    {selectedSchedule.total_instructor_score.toFixed(
                                        1,
                                    )}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-3">
                            {(selectedSchedule.sections ?? []).map(
                                (section, index) => (
                                    <div
                                        key={
                                            section.catalog_section_meeting_id ??
                                            `${selectedSchedule.schedule_id}-${index}`
                                        }
                                        className="border border-background/10 rounded-md p-3 text-sm"
                                    >
                                        <p className="font-semibold text-background">
                                            {section.course_name ??
                                                "Untitled course"}{" "}
                                            {section.section_code ?? ""}
                                        </p>
                                        <p className="text-background/60">
                                            {section.instructor_name ||
                                                "Instructor TBD"}
                                        </p>
                                        <div className="mt-2 space-y-1 text-xs text-background/55">
                                            {(section.meetings ?? []).map(
                                                (meeting) => (
                                                    <p
                                                        key={`${meeting.day_of_week}-${meeting.start_time}-${meeting.end_time}`}
                                                    >
                                                        {formatMeetingDay(
                                                            meeting.day_of_week,
                                                        )}{" "}
                                                        {formatTime(
                                                            meeting.start_time,
                                                        )}
                                                        {" - "}
                                                        {formatTime(
                                                            meeting.end_time,
                                                        )}
                                                    </p>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
            <div className="mt-auto">
                <button
                    type="button"
                    onClick={onBack}
                    className="w-full px-4 py-2 border border-background/20 text-background rounded-md font-semibold hover:bg-background/5 transition-colors"
                >
                    Back to Builder
                </button>
            </div>
        </aside>
    );
}
