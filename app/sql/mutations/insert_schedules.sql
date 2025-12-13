INSERT INTO schedules (
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
    campus_pattern
)
VALUES (
    :total_credits,
    :total_instructor_score,
    :num_sections,
    :meets_mon,
    :meets_tue,
    :meets_wed,
    :meets_thu,
    :meets_fri,
    :meets_sat,
    :earliest_start,
    :latest_end,
    :campus_pattern
)
RETURNING id;