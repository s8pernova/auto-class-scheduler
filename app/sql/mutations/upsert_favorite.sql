INSERT INTO favorites (schedule_id, favorited_at)
VALUES (:schedule_id, :favorited_at)
ON CONFLICT (schedule_id) DO UPDATE
    SET favorited_at = EXCLUDED.favorited_at
RETURNING id, schedule_id, favorited_at
