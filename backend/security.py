"""
Security Module for AI Code Auditor
Handles rate limiting, scan quotas, and security middleware.
"""

import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from logger import get_logger, get_security_logger, log_security_event

logger = get_logger('code_auditor.security')
security_logger = get_security_logger()

# --- Rate Limiting Configuration ---

# Per-IP rate limits
IP_RATE_LIMIT = 20  # requests per minute
IP_RATE_WINDOW = 60  # seconds

# Scan limits by tier
SCAN_LIMITS = {
    'free': {'daily_scans': 10, 'max_file_size_mb': 50},
    'premium': {'daily_scans': 50, 'max_file_size_mb': 100},
    'enterprise': {'daily_scans': -1, 'max_file_size_mb': 500},  # -1 = unlimited
}

DEFAULT_TIER = 'free'


def init_rate_limiter(app, db):
    """
    Initialize rate limiting for the Flask app.
    
    Uses Flask-Limiter for IP-based rate limiting and
    custom DB-based tracking for per-user scan quotas.
    """
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per minute"],
        storage_uri="memory://",
    )

    # Store limiter on app for access in other modules
    app.limiter = limiter

    # Register error handler for rate limit exceeded
    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        log_security_event(
            'RATE_LIMIT_EXCEEDED',
            f'Rate limit exceeded: {str(e.description)}',
            ip_address=request.remote_addr
        )
        return jsonify({
            'error': 'Rate limit exceeded. Please slow down.',
            'error_code': 'RATE_LIMIT_EXCEEDED',
            'retry_after': e.description
        }), 429

    return limiter


def create_rate_limit_model(db):
    """Create the RateLimit database model. Must be called after db is initialized."""

    class RateLimit(db.Model):
        __tablename__ = 'rate_limits'
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        scan_count = db.Column(db.Integer, default=0)
        reset_date = db.Column(db.DateTime, nullable=False)
        tier = db.Column(db.String(20), default=DEFAULT_TIER)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        def to_dict(self):
            tier_limits = SCAN_LIMITS.get(self.tier, SCAN_LIMITS[DEFAULT_TIER])
            daily_limit = tier_limits['daily_scans']
            remaining = max(0, daily_limit - self.scan_count) if daily_limit > 0 else -1

            return {
                'user_id': self.user_id,
                'tier': self.tier,
                'scan_count': self.scan_count,
                'daily_limit': daily_limit,
                'remaining_scans': remaining,
                'reset_date': self.reset_date.isoformat(),
                'is_limited': daily_limit > 0,
            }

    return RateLimit


def get_or_create_rate_limit(db, RateLimit, user_id):
    """Get or create a rate limit record for a user."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)

    rate_limit = RateLimit.query.filter_by(user_id=user_id).first()

    if not rate_limit:
        rate_limit = RateLimit(
            user_id=user_id,
            scan_count=0,
            reset_date=tomorrow_start,
            tier=DEFAULT_TIER
        )
        db.session.add(rate_limit)
        db.session.commit()
    elif rate_limit.reset_date <= datetime.utcnow():
        # Reset counters for new day
        rate_limit.scan_count = 0
        rate_limit.reset_date = tomorrow_start
        db.session.commit()
        logger.info(f'Rate limit reset for user {user_id}')

    return rate_limit


def check_scan_quota(db, RateLimit, user):
    """
    Check if a user has remaining scan quota.
    Admin users have unlimited scans.
    
    Args:
        user: User object (can also be user_id for backwards compatibility)
    
    Returns:
        tuple: (allowed: bool, rate_limit_info: dict)
    """
    # Handle both user object and user_id for backwards compatibility
    if isinstance(user, int):
        user_id = user
        is_admin = False
    else:
        user_id = user.id
        is_admin = getattr(user, 'is_admin', False)
    
    # Admin users have unlimited scans
    if is_admin:
        # Still create rate limit record but don't enforce
        rate_limit = get_or_create_rate_limit(db, RateLimit, user_id)
        unlimited_info = rate_limit.to_dict()
        unlimited_info['daily_limit'] = -1
        unlimited_info['remaining_scans'] = -1
        unlimited_info['is_limited'] = False
        unlimited_info['tier'] = 'admin'
        return True, unlimited_info
    
    rate_limit = get_or_create_rate_limit(db, RateLimit, user_id)
    tier_limits = SCAN_LIMITS.get(rate_limit.tier, SCAN_LIMITS[DEFAULT_TIER])
    daily_limit = tier_limits['daily_scans']

    # Unlimited for enterprise tier
    if daily_limit < 0:
        return True, rate_limit.to_dict()

    if rate_limit.scan_count >= daily_limit:
        log_security_event(
            'SCAN_QUOTA_EXCEEDED',
            f'User {user_id} exceeded daily scan quota ({rate_limit.scan_count}/{daily_limit})',
            user_id=user_id
        )
        return False, rate_limit.to_dict()

    return True, rate_limit.to_dict()


def increment_scan_count(db, RateLimit, user_id):
    """Increment the scan count for a user."""
    rate_limit = get_or_create_rate_limit(db, RateLimit, user_id)
    rate_limit.scan_count += 1
    db.session.commit()
    logger.info(f'Scan count incremented for user {user_id}: {rate_limit.scan_count}')
    return rate_limit.to_dict()


def scan_rate_limit_required(db, RateLimit):
    """
    Decorator factory that checks scan rate limits before allowing the scan.
    Must be used after @token_required.
    Admin users bypass all scan limits.
    """
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            # Pass full user object to check admin status
            allowed, rate_info = check_scan_quota(db, RateLimit, current_user)

            if not allowed:
                return jsonify({
                    'error': f'Daily scan limit reached ({rate_info["daily_limit"]} scans/day). Resets at {rate_info["reset_date"]}.',
                    'error_code': 'SCAN_LIMIT_EXCEEDED',
                    'rate_limit': rate_info
                }), 429

            # Add rate limit info to the request context
            g.rate_limit_info = rate_info
            return f(current_user, *args, **kwargs)

        return decorated
    return decorator


def add_rate_limit_headers(response, rate_info):
    """Add rate limiting headers to the response."""
    if rate_info:
        response.headers['X-RateLimit-Limit'] = str(rate_info.get('daily_limit', 0))
        response.headers['X-RateLimit-Remaining'] = str(rate_info.get('remaining_scans', 0))
        response.headers['X-RateLimit-Reset'] = rate_info.get('reset_date', '')
        response.headers['X-RateLimit-Tier'] = rate_info.get('tier', DEFAULT_TIER)
    return response


def setup_security_headers(app):
    """Add security headers to all responses."""

    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response
