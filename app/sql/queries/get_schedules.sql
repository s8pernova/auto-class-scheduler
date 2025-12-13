SELECT
    id,
    total_credits,
    total_instructor_score,
    num_sections,
    meets_mon,
    meets_tue,
    meets_wed,
    meets_thu,
    meets_fri,
    meets_sat,
    earliest_start,
    latest_end,
    campus_pattern,
    created_at
FROM schedules
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset;