SELECT
    ss.schedule_id,
    ss.subject_code,
    ss.course_number,
    ss.section_code,
    ss.credits,
    sm.day_of_week,
    sm.start_time,
    sm.end_time,
    sm.campus,
    sm.building,
    sm.room,
    sm.instructor_name,
    sm.instructor_rating
FROM schedule_sections AS ss
JOIN section_meetings AS sm
  ON ss.subject_code  = sm.subject_code
 AND ss.course_number = sm.course_number
 AND ss.section_code  = sm.section_code
ORDER BY ss.schedule_id, sm.day_of_week, sm.start_time;