"""
Structured Logging Configuration for AI Code Auditor
Provides rotating file logs with daily rotation and 30-day retention.
Windows-safe: uses copy+truncate rotation to avoid file locking issues.
"""

import os
import sys
import logging
import json
import shutil
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from datetime import datetime
from functools import wraps
import time
import traceback


class WindowsSafeTimedRotatingFileHandler(TimedRotatingFileHandler):
    """
    A TimedRotatingFileHandler that works reliably on Windows.
    
    On Windows, os.rename() fails if the target file is locked by another 
    process (e.g., OneDrive sync, antivirus, Flask reloader). This handler 
    uses copy+truncate instead of rename for rotation.
    """

    def rotate(self, source, dest):
        """Override rotation to use copy+truncate instead of rename on Windows."""
        if not os.path.exists(source):
            return
        try:
            # Try standard rename first (faster)
            if os.path.exists(dest):
                os.remove(dest)
            os.rename(source, dest)
        except (PermissionError, OSError):
            # Fallback: copy content then truncate original
            try:
                shutil.copy2(source, dest)
                # Truncate the source file instead of deleting/renaming
                with open(source, 'w'):
                    pass
            except (PermissionError, OSError):
                # If even copy fails, just truncate the original to prevent
                # unbounded growth - we lose the backup but avoid crashes
                try:
                    with open(source, 'w'):
                        pass
                except Exception:
                    pass  # Give up silently - logging errors shouldn't kill the app

# Create logs directory
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)


class StructuredFormatter(logging.Formatter):
    """JSON-structured log formatter for easy parsing and analysis."""

    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        if hasattr(record, 'ip_address'):
            log_entry['ip_address'] = record.ip_address
        if hasattr(record, 'endpoint'):
            log_entry['endpoint'] = record.endpoint
        if hasattr(record, 'method'):
            log_entry['method'] = record.method
        if hasattr(record, 'status_code'):
            log_entry['status_code'] = record.status_code
        if hasattr(record, 'duration_ms'):
            log_entry['duration_ms'] = record.duration_ms
        if hasattr(record, 'scan_type'):
            log_entry['scan_type'] = record.scan_type

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }

        return json.dumps(log_entry)


class ReadableFormatter(logging.Formatter):
    """Human-readable log formatter for console output."""

    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[1;31m', # Bold Red
    }
    RESET = '\033[0m'

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        msg = f"{color}[{timestamp}] {record.levelname:8s}{self.RESET} | {record.name} | {record.getMessage()}"

        if hasattr(record, 'user_id'):
            msg += f" | user={record.user_id}"
        if hasattr(record, 'ip_address'):
            msg += f" | ip={record.ip_address}"
        if hasattr(record, 'duration_ms'):
            msg += f" | {record.duration_ms}ms"

        if record.exc_info and record.exc_info[0] is not None:
            msg += '\n' + ''.join(traceback.format_exception(*record.exc_info))

        return msg


def setup_logging(app=None):
    """
    Set up structured logging with multiple handlers.
    
    Handlers:
    - Console: Human-readable format (INFO+)
    - app.log: All application logs with daily rotation (DEBUG+)
    - error.log: Error-level logs only (ERROR+)
    - security.log: Security-related events (INFO+)
    - access.log: HTTP request/response logs (INFO+)
    """

    # Root logger configuration
    root_logger = logging.getLogger('code_auditor')
    root_logger.setLevel(logging.DEBUG)

    # Remove existing handlers to prevent duplicates
    root_logger.handlers.clear()

    # --- Console Handler ---
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(ReadableFormatter())
    root_logger.addHandler(console_handler)

    # --- Application Log (Daily Rotation, 30 days) ---
    app_handler = WindowsSafeTimedRotatingFileHandler(
        os.path.join(LOG_DIR, 'app.log'),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    app_handler.setLevel(logging.DEBUG)
    app_handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(app_handler)

    # --- Error Log ---
    error_handler = WindowsSafeTimedRotatingFileHandler(
        os.path.join(LOG_DIR, 'error.log'),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(error_handler)

    # --- Security Log ---
    security_logger = logging.getLogger('code_auditor.security')
    security_handler = WindowsSafeTimedRotatingFileHandler(
        os.path.join(LOG_DIR, 'security.log'),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    security_handler.setLevel(logging.INFO)
    security_handler.setFormatter(StructuredFormatter())
    security_logger.addHandler(security_handler)

    # --- Access Log ---
    access_logger = logging.getLogger('code_auditor.access')
    access_handler = WindowsSafeTimedRotatingFileHandler(
        os.path.join(LOG_DIR, 'access.log'),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    access_handler.setLevel(logging.INFO)
    access_handler.setFormatter(StructuredFormatter())
    access_logger.addHandler(access_handler)

    # If Flask app is provided, configure its logger
    if app:
        app.logger.handlers = root_logger.handlers
        app.logger.setLevel(logging.DEBUG)

    return root_logger


def get_logger(name='code_auditor'):
    """Get a named logger instance."""
    return logging.getLogger(name)


def get_security_logger():
    """Get the security-specific logger."""
    return logging.getLogger('code_auditor.security')


def get_access_logger():
    """Get the access-specific logger."""
    return logging.getLogger('code_auditor.access')


def log_request(f):
    """Decorator to log HTTP request/response details."""
    @wraps(f)
    def decorated(*args, **kwargs):
        from flask import request as flask_request
        access_log = get_access_logger()
        start_time = time.time()

        # Log request
        extra = {
            'ip_address': flask_request.remote_addr,
            'endpoint': flask_request.endpoint,
            'method': flask_request.method,
        }

        try:
            response = f(*args, **kwargs)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            extra['duration_ms'] = duration_ms

            # Get status code from response
            if hasattr(response, 'status_code'):
                extra['status_code'] = response.status_code
            elif isinstance(response, tuple) and len(response) >= 2:
                extra['status_code'] = response[1]

            access_log.info(
                f"{flask_request.method} {flask_request.path}",
                extra=extra
            )
            return response

        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            extra['duration_ms'] = duration_ms
            extra['status_code'] = 500
            access_log.error(
                f"{flask_request.method} {flask_request.path} - EXCEPTION: {str(e)}",
                extra=extra,
                exc_info=True
            )
            raise

    return decorated


def log_security_event(event_type, message, user_id=None, ip_address=None, **kwargs):
    """Log a security-related event."""
    security_log = get_security_logger()
    extra = {
        'user_id': user_id,
        'ip_address': ip_address,
    }
    extra.update(kwargs)
    security_log.warning(f"[{event_type}] {message}", extra=extra)
