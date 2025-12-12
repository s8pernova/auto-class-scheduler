# Schedule Planner

Tools for scraping, normalizing, and querying course and section data for the Virginia Community College System (VCCS), with a focus on Northern Virginia Community College (NOVA).

The goal is to turn messy public schedule pages into clean JSON that can be used for personal schedule planning, analytics, or downstream apps.

---

## Features

- Pull public **course catalog data** from:
  - VCCS Master Course File exports (CSV, XLSX) if you have access
  - `courses.vccs.edu` course pages as a fallback
- Pull **section schedule data** from NOVA term schedule pages, for example  
  `https://www.nvcc.edu/academics/schedule/crs2262/Search?...`
- Normalize everything into a consistent JSON schema:
  - `Course` (prefix, number, title, description, credits, etc)
  - `Section` (CRN / class number, campus, mode, dates, notes)
  - `Meeting` (days, start time, end time, room)
- Basic **filtering and search** by:
  - campus, term, subject, course number
  - meeting days and time ranges
  - mode (in person, online, hybrid)
- Pluggable data sources so you can:
  - swap scraping with official data feeds later
  - add other VCCS colleges beyond NOVA

Future ideas, optional:

- Web UI for visual schedule building
- Export to iCal or JSON for other tools
- Caching and nightly refresh jobs

---

## Tech stack

Backend:

- **Python 3.12+**
- **FastAPI** for the HTTP API
- **HTTPX** or `requests` for fetching pages
- **BeautifulSoup4** or `lxml` for HTML parsing
- **Pydantic** models for clean schemas

Storage (optional but recommended):

- **PostgreSQL** for storing normalized course and section data

Tooling:

- **Poetry** or `uv` for dependency management
- **pytest** for tests
- **ruff** or `flake8` for linting

If you prefer another stack (Node, Go, etc), the high level layout still applies, you just swap out the implementation.
