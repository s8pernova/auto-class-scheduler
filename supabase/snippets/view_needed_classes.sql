SELECT DISTINCT
  subject_code,
  course_number,
  raw_days,
  start_time,
  end_time
FROM possible_classes
WHERE school_id = 3
ORDER BY 
  subject_code, 
  course_number, 
  raw_days, 
  start_time;