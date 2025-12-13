DELETE FROM favorites
WHERE schedule_id = :schedule_id
RETURNING schedule_id
