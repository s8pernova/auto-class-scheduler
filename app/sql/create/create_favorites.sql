CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure a schedule can only be favorited once (per user in the future)
    UNIQUE(schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_schedule_id ON favorites(schedule_id);
CREATE INDEX IF NOT EXISTS idx_favorites_favorited_at ON favorites(favorited_at);
