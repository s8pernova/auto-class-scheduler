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
    s.created_at
FROM schedules s
INNER JOIN favorites f ON s.id = f.schedule_id
ORDER BY f.favorited_at DESC
LIMIT :limit OFFSET :offset;