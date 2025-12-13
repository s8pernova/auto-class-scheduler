INSERT INTO favorites (schedule_id)
VALUES (:schedule_id)
ON CONFLICT (schedule_id) DO UPDATE
    SET favorited_at = NOW()
RETURNING id, schedule_id, favorited_at
