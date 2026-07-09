"""
Builders for cache query objects.
These are used to construct queries to the cache in a structured way (in a CachedGenerationSession model).
"""

from backend.api.v1.schemas.schedules import ScheduleGenerateResponse
from backend.cache.models import CachedGenerationSession


def build_generation_session(
    schedule: ScheduleGenerateResponse,
    *,
    filters,
) -> CachedGenerationSession:
    """
    Steps:
    1. Take valid generation schedule from the generator
    2. Collect every selected catalog_section_meeting_id
    3. Build one CachedCandidate per meeting candidate
    4. Build one CachedScheduleResult per generated schedule
    5. Compute summary metrics:
        - meeting days
        - number of meeting days
        - earliest start
        - latest end
        - total gap minutes
        - max single gap minutes
        - average instructor rating
        - rated/unrated instructor counts
    6. Return one CachedGenerationSession
    """

    pass
