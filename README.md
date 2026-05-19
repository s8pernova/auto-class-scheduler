# Course Scheduler

Automatically curate possible schedules for you.

## Production

```bash
docker compose up -d --build
```

## Developing

```bash
# Install
cp .env.example .env  # fill in Supabase creds and stuff
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run the API
uvicorn backend.app:app --reload --port 8020

# Run the frontend
cd ui && npm install && npm run dev
```