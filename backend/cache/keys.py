"""Redis key construction for generation-session cache entries.

Keep the key format here so schema/version changes do not leak throughout the
application. The configured namespace should include the app and cache schema,
for example ``course-scheduler:v1``.
"""

from __future__ import annotations


def generation_session_key(namespace: str, session_id: str) -> str:
    """Return the Redis key for a complete cached generation session."""
    namespace = _normalize_namespace(namespace)
    if not session_id:
        raise ValueError("session_id is required")
    return f"{namespace}:generation-session:{session_id}"


def generation_session_lookup_key(
    namespace: str,
    *,
    owner_scope_hash: str,
    search_fingerprint: str,
) -> str:
    """Return the Redis key that maps a stable search to its session id.

    This is for session reuse: if the same user/scope asks for the same
    normalized search universe before TTL expiry, the API can return the
    existing session instead of regenerating.
    """
    namespace = _normalize_namespace(namespace)
    if not owner_scope_hash:
        raise ValueError("owner_scope_hash is required")
    if not search_fingerprint:
        raise ValueError("search_fingerprint is required")
    return (
        f"{namespace}:generation-session-lookup:{owner_scope_hash}:{search_fingerprint}"
    )


def _normalize_namespace(namespace: str) -> str:
    normalized = namespace.strip().strip(":")
    if not normalized:
        raise ValueError("namespace is required")
    return normalized
