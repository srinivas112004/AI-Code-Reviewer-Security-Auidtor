"""
Day 2: Scan Result Caching System
- SHA-256 content hashing for cache keys
- In-memory cache with TTL (7 days)
- Cache hit/miss metrics tracking
- Cache invalidation support
"""

import hashlib
import time
import json
import threading
from datetime import datetime, timedelta
from logger import get_logger

logger = get_logger('cache')


class ScanCache:
    """In-memory scan result cache with TTL and metrics."""

    def __init__(self, default_ttl=7 * 24 * 3600, max_entries=1000):
        """
        Args:
            default_ttl: Default time-to-live in seconds (7 days).
            max_entries: Maximum cache entries before eviction.
        """
        self.default_ttl = default_ttl
        self.max_entries = max_entries
        self._cache = {}  # key -> { 'data': ..., 'expires_at': ..., 'created_at': ... }
        self._lock = threading.Lock()

        # Metrics
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._total_cached_scans = 0

    # ------------------------------------------------------------------ #
    #  Key helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def compute_file_hash(content: str) -> str:
        """SHA-256 hash of file content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    @staticmethod
    def build_cache_key(file_hash: str, model_version: str = 'default') -> str:
        """Build a deterministic cache key: scan:<hash>:<model>."""
        return f"scan:{file_hash}:{model_version}"

    # ------------------------------------------------------------------ #
    #  Core operations
    # ------------------------------------------------------------------ #

    def get(self, key: str):
        """
        Retrieve a cached result.
        Returns (data, True) on hit, (None, False) on miss.
        """
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._misses += 1
                return None, False

            if time.time() > entry['expires_at']:
                # Expired – remove it
                del self._cache[key]
                self._misses += 1
                self._evictions += 1
                return None, False

            self._hits += 1
            entry['last_accessed'] = time.time()
            entry['access_count'] = entry.get('access_count', 0) + 1
            return entry['data'], True

    def put(self, key: str, data, ttl: int = None):
        """Store a result in the cache."""
        ttl = ttl or self.default_ttl
        with self._lock:
            # Evict oldest entries if at capacity
            if len(self._cache) >= self.max_entries and key not in self._cache:
                self._evict_oldest()

            self._cache[key] = {
                'data': data,
                'created_at': time.time(),
                'expires_at': time.time() + ttl,
                'last_accessed': time.time(),
                'access_count': 0,
            }
            self._total_cached_scans += 1
            logger.info(f'Cache PUT: {key[:40]}... (TTL={ttl}s, entries={len(self._cache)})')

    def invalidate(self, key: str) -> bool:
        """Remove a specific key. Returns True if it existed."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.info(f'Cache INVALIDATE: {key[:40]}...')
                return True
            return False

    def invalidate_by_model(self, model_version: str) -> int:
        """Invalidate all entries for a specific model version."""
        removed = 0
        suffix = f":{model_version}"
        with self._lock:
            keys_to_remove = [k for k in self._cache if k.endswith(suffix)]
            for k in keys_to_remove:
                del self._cache[k]
                removed += 1
        if removed:
            logger.info(f'Cache INVALIDATE_MODEL: {model_version} ({removed} entries)')
        return removed

    def clear(self) -> int:
        """Flush entire cache. Returns count of entries removed."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info(f'Cache CLEAR: {count} entries removed')
            return count

    # ------------------------------------------------------------------ #
    #  Eviction
    # ------------------------------------------------------------------ #

    def _evict_oldest(self):
        """Evict the oldest (by last access) entry. Must be called under lock."""
        if not self._cache:
            return
        oldest_key = min(self._cache, key=lambda k: self._cache[k]['last_accessed'])
        del self._cache[oldest_key]
        self._evictions += 1

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        now = time.time()
        removed = 0
        with self._lock:
            expired_keys = [k for k, v in self._cache.items() if now > v['expires_at']]
            for k in expired_keys:
                del self._cache[k]
                removed += 1
                self._evictions += 1
        if removed:
            logger.info(f'Cache CLEANUP: {removed} expired entries removed')
        return removed

    # ------------------------------------------------------------------ #
    #  Metrics / Stats
    # ------------------------------------------------------------------ #

    def get_stats(self) -> dict:
        """Return cache statistics."""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0
            now = time.time()
            active_entries = sum(1 for v in self._cache.values() if now <= v['expires_at'])

            # Estimate memory (rough)
            memory_bytes = 0
            for v in self._cache.values():
                try:
                    memory_bytes += len(json.dumps(v['data']).encode('utf-8'))
                except Exception:
                    memory_bytes += 1024  # fallback estimate

            return {
                'total_entries': len(self._cache),
                'active_entries': active_entries,
                'max_entries': self.max_entries,
                'hits': self._hits,
                'misses': self._misses,
                'hit_rate': round(hit_rate, 1),
                'evictions': self._evictions,
                'total_cached_scans': self._total_cached_scans,
                'total_requests': total_requests,
                'default_ttl_hours': round(self.default_ttl / 3600, 1),
                'estimated_memory_mb': round(memory_bytes / (1024 * 1024), 2),
            }

    def get_entries_info(self, limit: int = 20) -> list:
        """Return info about cached entries (for admin dashboard)."""
        now = time.time()
        with self._lock:
            entries = []
            for key, val in list(self._cache.items())[:limit]:
                entries.append({
                    'key': key[:60] + ('...' if len(key) > 60 else ''),
                    'created_at': datetime.fromtimestamp(val['created_at']).isoformat(),
                    'expires_at': datetime.fromtimestamp(val['expires_at']).isoformat(),
                    'ttl_remaining_hours': round(max(0, val['expires_at'] - now) / 3600, 1),
                    'access_count': val.get('access_count', 0),
                })
            return entries


# ------------------------------------------------------------------ #
#  Singleton instance
# ------------------------------------------------------------------ #
scan_cache = ScanCache()


# ------------------------------------------------------------------ #
#  Helper: cache-aware file scan
# ------------------------------------------------------------------ #

def get_cached_scan_result(content: str, model_version: str = 'default'):
    """
    Check cache for a previous scan of the same file content.
    Returns (issues_list, cache_hit: bool).
    """
    file_hash = ScanCache.compute_file_hash(content)
    cache_key = ScanCache.build_cache_key(file_hash, model_version)
    data, hit = scan_cache.get(cache_key)
    return data, hit, cache_key, file_hash


def store_scan_result(cache_key: str, issues: list, ttl: int = None):
    """Store scan result for a file in cache."""
    scan_cache.put(cache_key, issues, ttl)
