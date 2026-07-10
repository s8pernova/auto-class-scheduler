import type {
    GeneratedScheduleResponse,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerationSessionResponse,
} from "@/api";
import ScheduleWeekPreview from "@/components/schedule/ScheduleWeekPreview";
import { formatTime } from "@/utils/scheduleResults";

type ResultsDetailsPanelProps = {
    generationResult: ScheduleGenerationSessionResponse;
    selectedSchedule: GeneratedScheduleResponse | null;
    blockedTimes?: ScheduleGenerateBlockedTimeInput[];
    onBack: () => void;
};

export default function ResultsDetailsPanel({
    generationResult,
    selectedSchedule,
    blockedTimes = [],
    onBack,
}: ResultsDetailsPanelProps) {
    return (
        <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-1">
                Details
            </h2>
            <div className="text-sm text-background/70 space-y-2">
                <p>{generationResult.candidateCount} total combinations</p>
                <p>{generationResult.generatedCount} valid schedules</p>
                <p>{generationResult.filteredCount} passed filters</p>
            </div>
            {selectedSchedule ? (
                <div className="min-h-0 overflow-y-auto border-t border-background/10 pt-4">
                    <h3 className="font-semibold text-background mb-2">
                        {selectedSchedule.resultId}
                    </h3>
                    <div className="text-sm text-background/70 space-y-1 mb-4">
                        <p>
                            {formatTime(
                                selectedSchedule.summary.earliestStart,
                            )}{" "}
                            -{" "}
                            {formatTime(selectedSchedule.summary.latestEnd)}
                        </p>
                        <p>
                            {selectedSchedule.summary.totalGapMinutes} total gap
                            minutes; {selectedSchedule.summary.maxSingleGapMinutes}{" "}
                            maximum single gap
                        </p>
                        {selectedSchedule.summary.averageInstructorRating !=
                        null ? (
                            <p>
                                Average instructor rating{" "}
                                {
                                    selectedSchedule.summary
                                        .averageInstructorRating
                                }
                            </p>
                        ) : null}
                        <p>
                            {selectedSchedule.summary.ratedInstructorCount} rated,{" "}
                            {selectedSchedule.summary.unratedInstructorCount}{" "}
                            unrated
                        </p>
                    </div>
                    <div className="mb-4">
                        <ScheduleWeekPreview
                            schedule={selectedSchedule}
                            blockedTimes={blockedTimes}
                        />
                    </div>
                    <div className="flex flex-col gap-3">
                        {selectedSchedule.sections.map((section) => (
                            <div
                                key={`${selectedSchedule.resultId}-detail-${section.courseName}-${section.sectionCode}`}
                                className="border border-background/10 rounded-md p-3 text-sm"
                            >
                                <p className="font-semibold text-background">
                                    {section.courseName}- {section.sectionCode}
                                </p>
                                <p className="text-background/60">
                                    {section.instructorName || "Instructor TBD"}
                                </p>
                                <div className="mt-2 space-y-1 text-xs text-background/55">
                                    {section.meetings.map((meeting) => (
                                        <p
                                            key={`${meeting.dayOfWeek}-${meeting.startTime}-${meeting.endTime}`}
                                        >
                                            {meeting.dayOfWeek}{" "}
                                            {formatTime(meeting.startTime)}
                                            {" - "}
                                            {formatTime(meeting.endTime)}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
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
