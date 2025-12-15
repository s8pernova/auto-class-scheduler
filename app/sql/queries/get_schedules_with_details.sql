WITH ranked_schedules AS (
    SELECT
        s.id,
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
        ROW_NUMBER() OVER (ORDER BY s.id DESC) as rn
    FROM schedules s
)
SELECT
    rs.id,
    rs.total_credits,
    rs.total_instructor_score,
    rs.num_sections,
    rs.meets_mon,
    rs.meets_tue,
    rs.meets_wed,
    rs.meets_thu,
    rs.meets_fri,
    rs.meets_sat,
    rs.earliest_start,
    rs.latest_end,
    rs.campus_pattern,
    rs.created_at,
    ss.subject_code,
    ss.course_number,
    ss.section_code,
    ss.course_title,
    ss.credits,
    pc.instructor_name,
    pc.instructor_rating,
    pc.campus,
    pc.day_of_week,
    pc.start_time,
    pc.end_time
FROM ranked_schedules rs
LEFT JOIN schedule_sections ss ON rs.id = ss.schedule_id
LEFT JOIN possible_classes pc ON
    ss.subject_code = pc.subject_code AND
    ss.course_number = pc.course_number AND
    ss.section_code = pc.section_code
WHERE rs.rn > :offset AND rs.rn <= :offset + :limit
ORDER BY rs.id, ss.subject_code, ss.course_number, pc.day_of_week, pc.start_time;
