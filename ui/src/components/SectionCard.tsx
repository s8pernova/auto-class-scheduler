export interface Meeting {
    day_of_week: string;
    start_time: string;
    end_time: string;
    campus: string;
}

export interface Section {
    subject_code: string;
    course_number: string;
    section_code: string;
    credits: number;
    modality: string;
    instructor_name?: string;
    instructor_rating?: number;
    meetings: Meeting[];
}

const formatTime = (timeStr: string) => {
    // Convert "HH:MM:SS" to "HH:MM AM/PM"
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
};

export default function SectionCard({ section }: { section: Section }) {
    return (
        <div className="bg-[#161f3e] p-4 rounded-2xl space-y-2">
            <h3 className="font-bold text-white">
                {section.subject_code} {section.course_number}
            </h3>
            <p className="text-sm text-gray-300">
                Section: {section.section_code} | Credits: {section.credits} | Mode:{" "}
                {section.modality}
            </p>
            {section.instructor_name && (
                <p className="text-sm text-gray-300">
                    Instructor: {section.instructor_name}
                    {section.instructor_rating && (
                        <span className="ml-2 text-yellow-400">
                            ★ {section.instructor_rating.toFixed(1)}
                        </span>
                    )}
                </p>
            )}
            <div className="space-y-1">
                {section.meetings.map((meeting, idx) => (
                    <div key={idx} className="text-xs text-gray-400 flex justify-between">
                        <span>{meeting.day_of_week}</span>
                        <span>
                            {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                        </span>
                        <span className="text-blue-300">{meeting.campus}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
