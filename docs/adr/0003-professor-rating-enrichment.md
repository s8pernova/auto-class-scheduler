# ADR 0003: Enrich schedule ranking with professor rating data

## Status

Proposed

## Date

2026-05-18

## Owners

Aidan Hoo

## Context

Students do not choose schedules based only on time conflicts. Instructor quality, perceived difficulty, and the number of available ratings can strongly affect which schedule a student prefers.

The scheduler already stores instructor names and an `instructor_rating` value on possible classes. This supports professor-aware ranking, but the source and maintenance process for ratings is not yet defined.

Rate My Professors is a common place students check before choosing classes, but direct automated collection from that site may violate its terms. The product must avoid depending on a fragile or disallowed scraping path.

Constraints:

- The core scheduler must work without professor ratings.
- Professor data must be optional enrichment, not a hard dependency.
- Any external data source must be replaceable.
- The app should avoid storing unnecessary review text.
- The app should avoid server-side scraping unless there is clear permission or a compliant provider agreement.

Assumptions:

- Users value instructor rating, difficulty, and rating count.
- A professor name may map to multiple people across schools.
- Professor matching is imperfect and requires confidence scoring.
- Some catalogs will provide instructor names but no rating data.

## Decision

Treat professor ratings as optional enrichment behind a provider interface. The MVP will support manual ratings and imported ratings from user-provided catalog data. A future Rate My Professors integration must be permission-safe, replaceable, and disabled by default until its legal and technical path is settled.

Decision details:

- Do not make Rate My Professors a required dependency.
- Do not ship backend scraping of Rate My Professors as the default path.
- Store aggregate rating fields, not full review text, unless a later ADR approves review storage.
- Track rating source and update time.
- Use professor rating as one scoring factor, not as the only ranking signal.
- Show missing ratings clearly instead of inventing values.

In scope:

- Manual professor rating entry
- CSV/imported professor rating fields
- Optional provider interface
- Rating source metadata
- Ranking logic that can use rating, difficulty, and rating count

Out of scope:

- Review text scraping
- Sentiment analysis on professor reviews
- Professor profile pages
- Institutional teaching evaluations
- Legal approval of any specific third-party data provider

## Rationale

Professor-aware ranking is a strong product differentiator, but making the platform depend on scraped data would create legal, technical, and reliability risk.

Reasons:

- The schedule generator should remain useful even when ratings are missing.
- Manual and imported ratings are enough for the first product version.
- A provider interface lets the app later support approved APIs, school-provided data, or user-provided data without changing the schedule engine.
- Aggregate metrics are easier to display responsibly than raw anonymous review text.
- Source metadata helps users understand whether a rating came from manual input, catalog import, or an external provider.

## Design and implementation notes

### Data model

Possible additions to `possible_classes`:

```sql
ALTER TABLE possible_classes
ADD COLUMN IF NOT EXISTS instructor_difficulty NUMERIC,
ADD COLUMN IF NOT EXISTS instructor_rating_count INTEGER,
ADD COLUMN IF NOT EXISTS instructor_rating_source TEXT,
ADD COLUMN IF NOT EXISTS instructor_rating_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS instructor_match_confidence NUMERIC;
```

Possible normalized table if ratings are reused across many sections:

```sql
CREATE TABLE instructor_profiles (
    id                 BIGSERIAL PRIMARY KEY,
    school_id          BIGINT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    instructor_name    TEXT NOT NULL,
    department         TEXT,
    external_source    TEXT,
    external_id        TEXT,
    avg_rating         NUMERIC,
    avg_difficulty     NUMERIC,
    rating_count       INTEGER,
    would_take_again   NUMERIC,
    source_url         TEXT,
    last_checked_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (school_id, external_source, external_id)
);
```

Possible section-to-profile link:

```sql
ALTER TABLE possible_classes
ADD COLUMN IF NOT EXISTS instructor_profile_id BIGINT REFERENCES instructor_profiles(id) ON DELETE SET NULL;
```

### Provider interface

```python
from typing import Protocol

class ProfessorRatingProvider(Protocol):
    def search_professor(self, *, school_name: str, professor_name: str) -> list[dict]:
        ...

    def get_professor_rating(self, *, external_id: str) -> dict:
        ...
```

Provider candidates:

```text
manual_input
catalog_csv_import
school_public_data
approved_partner_api
user_side_lookup
```

Rate My Professors remains a proposed provider, not an accepted dependency.

### Matching strategy

Professor matching should use:

```text
school name
instructor name
department
course subject
external profile id when known
```

The app should assign confidence:

```text
1.0 exact external profile id match
0.8 exact name + school match
0.6 name + department match
0.4 fuzzy name match
```

Low-confidence matches should require review before being used for ranking.

### Ranking use

Professor rating should be one weighted factor:

```text
schedule_score =
  time_score
  + professor_rating_weight
  - professor_difficulty_penalty
  + seat_availability_score
  + preference_score
```

Missing ratings should not destroy a schedule score. They should produce a neutral value or a separate warning.

### Security and privacy

- Store only aggregate professor metrics by default.
- Do not store raw review text in the MVP.
- Do not store user browsing cookies or Rate My Professors account data.
- Do not perform automated scraping from the backend unless a later ADR approves a compliant path.
- Show source labels such as `manual`, `csv_import`, or `external_provider`.

### Operations

- Manual/imported ratings can be updated during catalog import.
- External provider updates should be rate-limited and cached.
- Rating source failures should not block schedule generation.
- Logs should avoid storing professor review content.

## Consequences

Positive:

- Adds a major student decision factor to ranking.
- Keeps the core product usable without external services.
- Avoids building the product around a fragile scraping dependency.
- Keeps future provider options open.

Negative:

- Ratings may be missing or stale.
- Professor-name matching can be wrong.
- Manual data entry adds some user burden.
- External provider support needs separate legal and technical review.

Follow-ups:

- [ ] Add source metadata to professor rating fields.
- [ ] Add manual rating input to custom catalog creation.
- [ ] Add CSV columns for rating, difficulty, and rating count.
- [ ] Add a provider interface with no active RMP backend scraper.
- [ ] Add match-confidence display in admin/import tooling.
- [ ] Add a later ADR if an approved RMP or third-party provider path is chosen.

## Alternatives considered

1. Scrape Rate My Professors directly from the backend
   - Why not: Legal and reliability risk. The site terms may prohibit automated scraping.

2. Ignore professor ratings completely
   - Why not: Professor quality is one of the most important student decision factors.

3. Store only a single instructor_rating number
   - Why not: Rating count, difficulty, source, and update time matter for trust.

4. Store full professor reviews
   - Why not: More privacy, copyright, storage, and moderation risk than aggregate metrics.

## Rollout plan

1. Keep current schedule generation independent from professor ratings.
2. Add rating source metadata to imported catalog data.
3. Add manual rating fields in catalog builder UI.
4. Add professor-aware ranking as an optional sort/scoring setting.
5. Evaluate approved provider options separately before enabling external lookups.

## Open questions

- Should professor ratings be stored per section, per instructor profile, or both?
- Should users be allowed to override imported ratings in private catalogs?
- Should ratings affect default ranking or only appear as an optional sort?
- What confidence threshold should be required before using an external match?
