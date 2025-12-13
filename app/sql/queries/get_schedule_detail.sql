-- Get schedule summary with sections
SELECT
    s.id AS schedule_id,
    s.total_credits,
    s.total_instructor_score,
    s.num_sections,
    s.meets_mon,
    s.meets_tue,
    s.meets_wed,
    s.meets_thu,
    s.meets_fri,
    s.meets_sat,
    s.earliest_start,
    s.latest_end,
    s.campus_pattern,
    s.created_at,
    ss.subject_code,
    ss.course_number,
    ss.section_code,
    ss.course_title,
    ss.credits
FROM schedules s
LEFT JOIN schedule_sections ss ON s.id = ss.schedule_id
WHERE s.id = :schedule_id
ORDER BY s.id, ss.subject_code, ss.course_number;