"""
Input Validation & Sanitization for AI Code Auditor
Validates file uploads, GitHub URLs, and API inputs.
"""

import os
import re
import zipfile
from logger import get_logger, log_security_event

logger = get_logger('code_auditor.validators')

# --- Configuration Constants ---

# Maximum file upload size (50 MB)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_FILE_SIZE_MB = 50

# Maximum uncompressed size for ZIP files (500 MB - ZIP bomb protection)
MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024  # 500 MB

# Maximum compression ratio (ZIP bomb detection)
MAX_COMPRESSION_RATIO = 100  # If ratio > 100:1, likely a ZIP bomb

# Allowed file extensions for upload
ALLOWED_UPLOAD_EXTENSIONS = {'.zip'}

# Blocked file extensions inside archives
BLOCKED_EXTENSIONS = {
    '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.scr',
    '.pif', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
    '.ps1', '.psm1', '.psd1',  # PowerShell scripts  
    '.sh', '.bash',  # Shell scripts (when in archives - scanning .sh in code repos is fine)
    '.bin', '.app', '.dmg', '.iso',
    '.sys', '.drv', '.ocx',
}

# Allowed code file extensions for scanning
ALLOWED_CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.jsx', '.tsx',
    '.java', '.c', '.cpp', '.c++', '.cc', '.h', '.hpp',
    '.go', '.rs', '.rb', '.php',
    '.html', '.css', '.scss', '.less',
    '.json', '.xml', '.yaml', '.yml', '.toml',
    '.md', '.txt', '.cfg', '.ini', '.env',
    '.sql', '.graphql',
    '.swift', '.kt', '.kts',
    '.r', '.R', '.dart', '.lua', '.scala',
    '.sh', '.bash', '.zsh',  # Shell scripts OK for code scanning
}

# GitHub URL validation regex
GITHUB_URL_PATTERN = re.compile(
    r'^https?://github\.com/[\w.-]+/[\w.-]+/?$',
    re.IGNORECASE
)

# General Git URL patterns (GitHub, GitLab, Bitbucket)
GIT_URL_PATTERN = re.compile(
    r'^https?://(github\.com|gitlab\.com|bitbucket\.org)/[\w.-]+/[\w.-]+(/.*)?$',
    re.IGNORECASE
)

# Maximum filename length
MAX_FILENAME_LENGTH = 255

# Maximum number of files in a ZIP
MAX_FILES_IN_ZIP = 5000

# Maximum individual file size inside ZIP (10 MB per file)
MAX_INDIVIDUAL_FILE_SIZE = 10 * 1024 * 1024


class ValidationError(Exception):
    """Custom exception for validation errors."""
    def __init__(self, message, error_code=None, details=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or 'VALIDATION_ERROR'
        self.details = details or {}

    def to_dict(self):
        return {
            'error': self.message,
            'error_code': self.error_code,
            'details': self.details
        }


def validate_file_upload(file_storage):
    """
    Validate an uploaded file.
    
    Args:
        file_storage: Flask FileStorage object
        
    Returns:
        dict with validation result
        
    Raises:
        ValidationError if validation fails
    """
    if not file_storage or file_storage.filename == '':
        raise ValidationError(
            'No file provided',
            error_code='NO_FILE'
        )

    filename = file_storage.filename

    # Check filename length
    if len(filename) > MAX_FILENAME_LENGTH:
        raise ValidationError(
            f'Filename too long (max {MAX_FILENAME_LENGTH} characters)',
            error_code='FILENAME_TOO_LONG'
        )

    # Check for path traversal attempts
    if '..' in filename or '/' in filename or '\\' in filename:
        log_security_event(
            'PATH_TRAVERSAL_ATTEMPT',
            f'Path traversal detected in filename: {filename}'
        )
        raise ValidationError(
            'Invalid filename: path traversal not allowed',
            error_code='PATH_TRAVERSAL'
        )

    # Check file extension
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValidationError(
            f'File type "{ext}" not allowed. Only {", ".join(ALLOWED_UPLOAD_EXTENSIONS)} files are accepted.',
            error_code='INVALID_FILE_TYPE',
            details={'allowed_types': list(ALLOWED_UPLOAD_EXTENSIONS)}
        )

    # Check file size
    file_storage.seek(0, os.SEEK_END)
    file_size = file_storage.tell()
    file_storage.seek(0)  # Reset file pointer

    if file_size == 0:
        raise ValidationError(
            'File is empty',
            error_code='EMPTY_FILE'
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            f'File too large ({file_size / (1024*1024):.1f} MB). Maximum size is {MAX_FILE_SIZE_MB} MB.',
            error_code='FILE_TOO_LARGE',
            details={'max_size_mb': MAX_FILE_SIZE_MB, 'file_size_mb': round(file_size / (1024*1024), 1)}
        )

    # Verify it's actually a ZIP file by checking magic bytes
    header = file_storage.read(4)
    file_storage.seek(0)

    if header[:2] != b'PK':
        log_security_event(
            'INVALID_FILE_CONTENT',
            f'File claims to be ZIP but has invalid header: {filename}'
        )
        raise ValidationError(
            'File content does not match ZIP format',
            error_code='INVALID_CONTENT_TYPE'
        )

    logger.info(f'File upload validated: {filename} ({file_size / 1024:.1f} KB)')
    return {
        'valid': True,
        'filename': filename,
        'size_bytes': file_size,
        'extension': ext
    }


def validate_zip_contents(zip_path):
    """
    Validate ZIP file contents for security (ZIP bomb detection, blocked files).
    
    Args:
        zip_path: Path to the ZIP file
        
    Raises:
        ValidationError if validation fails
    """
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Check number of files
            file_count = len(zf.namelist())
            if file_count > MAX_FILES_IN_ZIP:
                raise ValidationError(
                    f'ZIP contains too many files ({file_count}). Maximum is {MAX_FILES_IN_ZIP}.',
                    error_code='TOO_MANY_FILES',
                    details={'file_count': file_count, 'max_files': MAX_FILES_IN_ZIP}
                )

            # Calculate total uncompressed size
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            total_compressed = os.path.getsize(zip_path)

            # ZIP bomb detection: check compression ratio
            if total_compressed > 0:
                compression_ratio = total_uncompressed / total_compressed
                if compression_ratio > MAX_COMPRESSION_RATIO:
                    log_security_event(
                        'ZIP_BOMB_DETECTED',
                        f'Suspicious compression ratio: {compression_ratio:.1f}:1',
                        details={'ratio': compression_ratio}
                    )
                    raise ValidationError(
                        'Suspicious file detected: compression ratio too high (possible ZIP bomb)',
                        error_code='ZIP_BOMB_DETECTED',
                        details={'compression_ratio': round(compression_ratio, 1)}
                    )

            # Check total uncompressed size
            if total_uncompressed > MAX_UNCOMPRESSED_SIZE:
                raise ValidationError(
                    f'Uncompressed size too large ({total_uncompressed / (1024*1024):.1f} MB). Maximum is {MAX_UNCOMPRESSED_SIZE / (1024*1024):.0f} MB.',
                    error_code='UNCOMPRESSED_TOO_LARGE',
                    details={'uncompressed_mb': round(total_uncompressed / (1024*1024), 1)}
                )

            # Check for blocked file types and path traversal
            blocked_files = []
            for info in zf.infolist():
                # Path traversal check
                if '..' in info.filename or info.filename.startswith('/'):
                    log_security_event(
                        'PATH_TRAVERSAL_IN_ZIP',
                        f'Path traversal in ZIP entry: {info.filename}'
                    )
                    raise ValidationError(
                        'ZIP contains files with suspicious paths (possible path traversal attack)',
                        error_code='ZIP_PATH_TRAVERSAL'
                    )

                # Check individual file sizes
                if info.file_size > MAX_INDIVIDUAL_FILE_SIZE:
                    logger.warning(f'Large file in ZIP: {info.filename} ({info.file_size / (1024*1024):.1f} MB)')

                # Check for blocked extensions
                _, ext = os.path.splitext(info.filename.lower())
                if ext in BLOCKED_EXTENSIONS:
                    blocked_files.append(info.filename)

            if blocked_files:
                log_security_event(
                    'BLOCKED_FILES_IN_ZIP',
                    f'ZIP contains blocked file types: {blocked_files[:5]}'
                )
                raise ValidationError(
                    f'ZIP contains blocked file types: {", ".join(blocked_files[:5])}{"..." if len(blocked_files) > 5 else ""}',
                    error_code='BLOCKED_FILE_TYPES',
                    details={'blocked_files': blocked_files[:10]}
                )

            logger.info(f'ZIP validated: {file_count} files, {total_uncompressed / 1024:.1f} KB uncompressed')

    except zipfile.BadZipFile:
        raise ValidationError(
            'Invalid or corrupted ZIP file',
            error_code='BAD_ZIP_FILE'
        )


def validate_github_url(url):
    """
    Validate and sanitize a GitHub repository URL.
    
    Args:
        url: The URL to validate
        
    Returns:
        Sanitized URL string
        
    Raises:
        ValidationError if validation fails
    """
    if not url or not isinstance(url, str):
        raise ValidationError(
            'GitHub URL is required',
            error_code='NO_URL'
        )

    # Strip whitespace
    url = url.strip()

    # Check length
    if len(url) > 500:
        raise ValidationError(
            'URL is too long (max 500 characters)',
            error_code='URL_TOO_LONG'
        )

    # Validate against GitHub URL pattern
    if not GITHUB_URL_PATTERN.match(url):
        # Try git URL pattern for other platforms
        if GIT_URL_PATTERN.match(url):
            raise ValidationError(
                'Only GitHub repositories are supported at this time',
                error_code='NON_GITHUB_URL',
                details={'supported_platforms': ['github.com']}
            )
        raise ValidationError(
            'Invalid GitHub URL. Expected format: https://github.com/owner/repository',
            error_code='INVALID_GITHUB_URL',
            details={'expected_format': 'https://github.com/owner/repository'}
        )

    # Remove trailing slash for consistency
    url = url.rstrip('/')

    # Ensure it uses HTTPS
    if url.startswith('http://'):
        url = 'https://' + url[7:]

    logger.info(f'GitHub URL validated: {url}')
    return url


def validate_scan_request(request):
    """
    Validate the complete scan request (file or GitHub URL).
    
    Args:
        request: Flask request object
        
    Returns:
        dict with scan_type ('zip' or 'github') and validated data
        
    Raises:
        ValidationError if validation fails
    """
    has_file = 'file' in request.files and request.files['file'].filename != ''
    has_url = request.is_json and 'github_url' in request.json and request.json['github_url']

    if not has_file and not has_url:
        raise ValidationError(
            'Please provide either a ZIP file upload or a GitHub repository URL',
            error_code='NO_INPUT'
        )

    if has_file and has_url:
        raise ValidationError(
            'Please provide either a ZIP file or a GitHub URL, not both',
            error_code='MULTIPLE_INPUTS'
        )

    if has_file:
        file_info = validate_file_upload(request.files['file'])
        return {
            'scan_type': 'zip',
            'file': request.files['file'],
            'file_info': file_info
        }
    else:
        validated_url = validate_github_url(request.json['github_url'])
        return {
            'scan_type': 'github',
            'url': validated_url
        }


def sanitize_string(value, max_length=500, allow_html=False):
    """Sanitize a string input."""
    if not isinstance(value, str):
        return ''

    # Trim whitespace
    value = value.strip()

    # Truncate to max length
    value = value[:max_length]

    # Remove HTML tags if not allowed
    if not allow_html:
        value = re.sub(r'<[^>]+>', '', value)

    # Remove null bytes
    value = value.replace('\x00', '')

    return value


def validate_pagination(request, max_limit=100):
    """Validate pagination parameters."""
    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
    except (TypeError, ValueError):
        raise ValidationError(
            'Invalid pagination parameters',
            error_code='INVALID_PAGINATION'
        )

    if limit < 1 or limit > max_limit:
        limit = min(max(limit, 1), max_limit)

    if offset < 0:
        offset = 0

    return limit, offset
