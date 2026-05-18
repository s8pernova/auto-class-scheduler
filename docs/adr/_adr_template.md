<!-- File name example: 0001-adr-template.md (remove this line later) -->

# ADR NNNN: <Short decision title>

## Status

Proposed | Accepted | Rejected | Superseded | Deprecated <!-- Default to 'Proposed' -->

## Date

YYYY-MM-DD <!-- Default to current date -->

## Owners

<team or names> <!-- Default to 'Aidan Hoo' -->

## Context

<What problem are we solving, and why now?>

Constraints:

- <budget/time/platform constraint>
- <security/privacy constraint>
- <operational constraint>

Assumptions:

- <assumption 1>
- <assumption 2>

## Decision

<One paragraph stating exactly what we are doing.>

Decision details:

- <key point 1>
- <key point 2>
- <key point 3>

In scope:

- <what this ADR covers>

Out of scope:

- <explicitly excluded items>

## Rationale

<Why this choice beats the alternatives for this project right now.>
- <reason tied to constraints>
- <reason tied to operational needs>
- <reason tied to future changes>

## Design and implementation notes

### Data model

- Tables/columns:
  - `<table>.<column>`: <purpose>
- Indexes:
  - <index>: <why>

### API / interfaces

- Endpoints / CLIs:
  - `METHOD /path`: <what it does>
  - `python -m ...`: <what it does>

### Security and privacy

- Access rules (RLS, roles):
  - <rule>
- Data handling:
  - <what is stored>
  - <what is never stored>

### Operations

- Scheduling / runtime:
  - <timer/worker cadence>
- Observability:
  - Logs: <where>
  - Metrics: <what>
  - Alerts: <when>

## Consequences

Positive:

- <benefit 1>
- <benefit 2>

Negative:

- <cost 1>
- <cost 2>

Follow-ups:

- [ ] <work item 1>
- [ ] <work item 2>

## Alternatives considered

1. <alternative name>
   - Why not: <short reason>

2. <alternative name>
   - Why not: <short reason>

## Rollout plan

1. <step 1>
2. <step 2>
3. <step 3>

## Open questions (remove if not needed)

- <question 1>
- <question 2>
