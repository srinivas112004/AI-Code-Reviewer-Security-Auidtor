import os
import stat
import google.generativeai as genai
from flask import Flask, request, jsonify, Response, g
from flask_cors import CORS
from dotenv import load_dotenv
import git
import tempfile
import zipfile
import shutil
import json
import time
import ast
import hashlib
import re
from collections import defaultdict
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from functools import wraps
import jwt
import bcrypt
import secrets
import traceback
# Using built-in modules for code analysis instead of radon for better compatibility

# --- Day 1: Logging, Validation, Security ---
from logger import setup_logging, get_logger, get_security_logger, log_request, log_security_event
from validators import (
    ValidationError, validate_file_upload, validate_zip_contents,
    validate_github_url, validate_scan_request, sanitize_string
)
from security import (
    init_rate_limiter, create_rate_limit_model, get_or_create_rate_limit,
    check_scan_quota, increment_scan_count, scan_rate_limit_required,
    add_rate_limit_headers, setup_security_headers, SCAN_LIMITS
)
from cache import scan_cache, get_cached_scan_result, store_scan_result

# --- Day 4: AI Enhancements ---
from ai_models import MultiModelManager
from risk_calculator import prioritize_issues, get_fix_first_top_n, get_risk_matrix_summary
from feedback import create_feedback_model, FeedbackProcessor

# --- Day 5: Code Fixes & Snippet Library ---
from fix_generator import FixGenerator

# --- Email Service ---
from email_service import send_otp_email, generate_otp, is_smtp_configured


# Helper function to handle permission errors on Windows
def remove_readonly(func, path, _):
    "Clear the readonly bit and reattempt the removal"
    os.chmod(path, stat.S_IWRITE)
    func(path)

# --- CODE METRICS ANALYSIS FUNCTIONS ---

def calculate_cyclomatic_complexity(code, file_path):
    """Calculate cyclomatic complexity for a code file"""
    try:
        if file_path.endswith('.py'):
            tree = ast.parse(code)
            complexity_sum = 0
            function_count = 0
            
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    function_count += 1
                    # Simple complexity calculation
                    complexity = 1  # Base complexity
                    for child in ast.walk(node):
                        if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor, 
                                            ast.ExceptHandler, ast.With, ast.AsyncWith)):
                            complexity += 1
                        elif isinstance(child, ast.BoolOp):
                            complexity += len(child.values) - 1
                    complexity_sum += complexity
            
            return complexity_sum / max(function_count, 1)
        else:
            # For non-Python files, use simple heuristics
            lines = code.split('\n')
            complexity = 1
            for line in lines:
                if re.search(r'\b(if|while|for|switch|case)\b', line.lower()):
                    complexity += 1
            return min(complexity / max(len(lines), 1) * 100, 10)  # Normalize to 0-10
    except:
        return 1.0

def calculate_code_duplication(all_files_content):
    """Calculate code duplication percentage across all files"""
    try:
        # Create hashes for code blocks (functions, classes)
        block_hashes = defaultdict(list)
        total_blocks = 0
        
        for file_path, content in all_files_content.items():
            if file_path.endswith('.py'):
                try:
                    tree = ast.parse(content)
                    for node in ast.walk(tree):
                        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
                            # Get the source code of this block
                            try:
                                block_code = ast.get_source_segment(content, node)
                                if block_code and len(block_code.strip()) > 50:  # Only significant blocks
                                    block_hash = hashlib.md5(block_code.strip().encode()).hexdigest()
                                    block_hashes[block_hash].append((file_path, node.name if hasattr(node, 'name') else 'unknown'))
                                    total_blocks += 1
                            except:
                                continue
                except:
                    # For non-parseable Python files, use line-based hashing
                    lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('#')]
                    for i in range(0, len(lines) - 5, 3):  # Check every 3rd line with 5-line blocks
                        block = '\n'.join(lines[i:i+5])
                        if len(block) > 50:
                            block_hash = hashlib.md5(block.encode()).hexdigest()
                            block_hashes[block_hash].append((file_path, f'lines_{i}-{i+5}'))
                            total_blocks += 1
            else:
                # For other file types, use simple line-based comparison
                lines = [line.strip() for line in content.split('\n') if line.strip()]
                for i in range(0, len(lines) - 3, 2):  # Smaller blocks for non-Python
                    block = '\n'.join(lines[i:i+3])
                    if len(block) > 30:
                        block_hash = hashlib.md5(block.encode()).hexdigest()
                        block_hashes[block_hash].append((file_path, f'lines_{i}-{i+3}'))
                        total_blocks += 1
        
        # Count duplicated blocks
        duplicated_blocks = sum(1 for locations in block_hashes.values() if len(locations) > 1)
        
        if total_blocks == 0:
            return 0.0
        
        duplication_percentage = (duplicated_blocks / total_blocks) * 100
        return min(duplication_percentage, 100.0)
        
    except Exception as e:
        print(f"Error calculating duplication: {e}")
        return 0.0

def scan_dependencies_vulnerabilities(scan_path):
    """Scan for vulnerable dependencies in package files"""
    vulnerable_deps = 0
    dependency_files = ['package.json', 'requirements.txt', 'pom.xml', 'Gemfile', 'composer.json']
    
    try:
        for root, dirs, files in os.walk(scan_path):
            for file in files:
                if file in dependency_files:
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        # Simple vulnerability patterns (you can expand this)
                        vulnerable_patterns = [
                            r'jquery.*["\']\s*["\']?[0-2]\.',  # Old jQuery versions
                            r'express.*["\']\s*["\']?[0-3]\.',  # Old Express versions
                            r'lodash.*["\']\s*["\']?[0-3]\.',   # Old Lodash versions
                            r'django.*["\']\s*["\']?[0-2]\.',   # Old Django versions
                            r'flask.*["\']\s*["\']?[0-1]\.',    # Very old Flask versions
                        ]
                        
                        for pattern in vulnerable_patterns:
                            if re.search(pattern, content, re.IGNORECASE):
                                vulnerable_deps += 1
                                
                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")
                        continue
                        
    except Exception as e:
        print(f"Error scanning dependencies: {e}")
    
    return vulnerable_deps

def save_scan_to_database(scan_data, scan_type, source_identifier, scan_duration, user_id=None):
    """Save scan results to database"""
    try:
        # Count issues by severity
        issue_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        for issue in scan_data.get('issues', []):
            severity = issue.get('severity', 'low').lower()
            if severity in issue_counts:
                issue_counts[severity] += 1
        
        # Create scan history record
        scan_record = ScanHistory(
            user_id=user_id,
            scan_type=scan_type,
            source_identifier=source_identifier,
            overall_score=scan_data.get('overall_score', 0),
            code_complexity=scan_data.get('metrics', {}).get('code_complexity', 0),
            duplication_percentage=scan_data.get('metrics', {}).get('duplication_percentage', 0),
            vulnerable_dependencies=scan_data.get('metrics', {}).get('vulnerable_dependencies', 0),
            total_issues=len(scan_data.get('issues', [])),
            critical_issues=issue_counts['critical'],
            high_issues=issue_counts['high'],
            medium_issues=issue_counts['medium'],
            low_issues=issue_counts['low'],
            files_scanned=scan_data.get('files_scanned', 0),
            scan_duration=scan_duration
        )
        
        db.session.add(scan_record)
        db.session.flush()  # Get the scan ID
        
        # Save individual issues
        for issue in scan_data.get('issues', []):
            issue_record = ScanIssue(
                scan_id=scan_record.id,
                file_path=issue.get('file', ''),
                severity=issue.get('severity', 'Low'),
                description=issue.get('description', ''),
                suggestion=issue.get('suggestion', ''),
                line_number=issue.get('line_number'),
                code_snippet=issue.get('code_snippet', '')
            )
            db.session.add(issue_record)
        
        db.session.commit()
        return scan_record.id
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving scan to database: {e}")
        return None

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
]}}, expose_headers=[
    'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Tier'
])

# --- LOGGING SETUP ---
app_logger = setup_logging(app)
logger = get_logger('code_auditor')

# --- DATABASE CONFIGURATION ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///code_auditor.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,       # Check connections before use
    'pool_recycle': 300,         # Recycle connections after 5 min
}
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['JWT_EXPIRATION_HOURS'] = 24
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB max upload
db = SQLAlchemy(app)

# --- RATE LIMITING ---
limiter = init_rate_limiter(app, db)

# --- SECURITY HEADERS ---
setup_security_headers(app)

# --- JWT HELPER FUNCTIONS ---

def generate_token(user_id, is_admin=False):
    """Generate JWT token for a user"""
    payload = {
        'user_id': user_id,
        'is_admin': is_admin,
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        # Get user from database
        current_user = User.query.get(payload['user_id'])
        if not current_user:
            return jsonify({'error': 'User not found'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to protect routes that require admin access"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        if not payload.get('is_admin', False):
            return jsonify({'error': 'Admin access required'}), 403
        
        current_user = User.query.get(payload['user_id'])
        if not current_user:
            return jsonify({'error': 'User not found'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# --- DATABASE MODELS ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    scans = db.relationship('ScanHistory', backref='user', lazy=True)

    def set_password(self, password):
        """Hash and set the user's password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Check if the provided password matches the hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'total_scans': len(self.scans)
        }

class ScanHistory(db.Model):
    __table_args__ = (
        db.Index('idx_user_scans', 'user_id', 'created_at'),
        db.Index('idx_scan_type', 'scan_type'),
        db.Index('idx_scan_created', 'created_at'),
        db.Index('idx_scan_score', 'overall_score'),
    )
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Optional for anonymous scans
    scan_type = db.Column(db.String(20), nullable=False)  # 'zip' or 'github'
    source_identifier = db.Column(db.String(500), nullable=False)  # file name or GitHub URL
    overall_score = db.Column(db.Float, nullable=False)
    code_complexity = db.Column(db.Float, nullable=False)
    duplication_percentage = db.Column(db.Float, nullable=False)
    vulnerable_dependencies = db.Column(db.Integer, nullable=False)
    total_issues = db.Column(db.Integer, nullable=False)
    critical_issues = db.Column(db.Integer, default=0)
    high_issues = db.Column(db.Integer, default=0)
    medium_issues = db.Column(db.Integer, default=0)
    low_issues = db.Column(db.Integer, default=0)
    files_scanned = db.Column(db.Integer, nullable=False)
    scan_duration = db.Column(db.Float, nullable=True)  # Duration in seconds
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    issues = db.relationship('ScanIssue', backref='scan', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'scan_type': self.scan_type,
            'source_identifier': self.source_identifier,
            'overall_score': self.overall_score,
            'metrics': {
                'code_complexity': self.code_complexity,
                'duplication_percentage': self.duplication_percentage,
                'vulnerable_dependencies': self.vulnerable_dependencies
            },
            'issue_counts': {
                'total': self.total_issues,
                'critical': self.critical_issues,
                'high': self.high_issues,
                'medium': self.medium_issues,
                'low': self.low_issues
            },
            'files_scanned': self.files_scanned,
            'scan_duration': self.scan_duration,
            'created_at': self.created_at.isoformat()
        }

class ScanIssue(db.Model):
    __table_args__ = (
        db.Index('idx_issue_scan', 'scan_id'),
        db.Index('idx_issue_severity', 'severity'),
        db.Index('idx_issue_file', 'file_path'),
    )
    id = db.Column(db.Integer, primary_key=True)
    scan_id = db.Column(db.Integer, db.ForeignKey('scan_history.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    suggestion = db.Column(db.Text, nullable=False)
    line_number = db.Column(db.Integer, nullable=True)
    code_snippet = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'file': self.file_path,
            'severity': self.severity,
            'description': self.description,
            'suggestion': self.suggestion,
            'line_number': self.line_number,
            'code_snippet': self.code_snippet
        }

# --- PASSWORD RESET TOKEN MODEL ---
class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)

    def is_expired(self):
        return datetime.utcnow() > self.expires_at

# --- EMAIL VERIFICATION TOKEN MODEL ---
class EmailVerificationToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    token = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    verified = db.Column(db.Boolean, default=False)

    def is_expired(self):
        return datetime.utcnow() > self.expires_at

# --- RATE LIMIT MODEL ---
RateLimit = create_rate_limit_model(db)

# --- Day 4: FALSE POSITIVE FEEDBACK MODEL ---
FalsePositive = create_feedback_model(db)

# Initialize database tables
with app.app_context():
    db.create_all()
    # Dynamic migration to add code_snippet to scan_issue if it doesn't exist
    try:
        from sqlalchemy import text
        connection = db.engine.connect()
        cursor = connection.execute(text("PRAGMA table_info(scan_issue)"))
        columns = [row[1] for row in cursor.fetchall()]
        if 'code_snippet' not in columns:
            print("Migrating database: adding code_snippet column to scan_issue table...")
            connection.execute(text("ALTER TABLE scan_issue ADD COLUMN code_snippet TEXT"))
            print("Migration successful.")
        connection.close()
    except Exception as e:
        print(f"Database migration check completed: {e}")

try:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable not found")
    
    # Clear any existing configuration and environment variables
    genai.configure(api_key=None)
    
    # Remove any Google Cloud environment variables that might interfere
    import os
    for env_var in ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT']:
        if env_var in os.environ:
            del os.environ[env_var]
    
    # Configure ONLY for Gemini API Studio (not Vertex AI)
    genai.configure(api_key=api_key)
    
    # List available models to find the correct one
    print("Checking available models...")
    try:
        available_models = []
        for model in genai.list_models():
            if 'generateContent' in model.supported_generation_methods:
                available_models.append(model.name)
                print(f"Available model: {model.name}")
        
        # Try to use the best available model (prioritize 2.5 Flash for latest features)
        if 'models/gemini-2.5-flash' in available_models:
            model_name = 'gemini-2.5-flash'
        elif 'models/gemini-1.5-flash' in available_models:
            model_name = 'gemini-1.5-flash'
        elif 'models/gemini-2.5-flash-lite' in available_models:
            model_name = 'gemini-2.5-flash-lite'
        elif 'models/gemini-1.5-flash-8b' in available_models:
            model_name = 'gemini-1.5-flash-8b'
        elif 'models/gemini-1.5-pro' in available_models:
            model_name = 'gemini-1.5-pro'
        else:
            # Use the first available model
            model_name = available_models[0].replace('models/', '') if available_models else 'gemini-2.0-flash'
        
        model = genai.GenerativeModel(model_name)
        print(f"Successfully using model: {model_name}")
        
    except Exception as list_error:
        print(f"Could not list models: {list_error}")
        # Fallback to a basic model name
        model = genai.GenerativeModel('gemini-2.0-flash')
        print("Using fallback model: gemini-2.0-flash")
    
    print("Gemini API configured successfully.")
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    model = None

# --- Day 4: Multi-Model Manager + Feedback Processor ---
multi_model_mgr = MultiModelManager(gemini_model=model)
feedback_processor = FeedbackProcessor(db, FalsePositive)
print(f"Available AI models: {[m['name'] for m in multi_model_mgr.get_available_models() if m['available']]}")

# --- Day 5: Fix Generator + Snippet Library ---
fix_generator = FixGenerator(gemini_model=model)

def _load_secure_patterns():
    """Load secure code patterns from JSON file."""
    patterns_path = os.path.join(os.path.dirname(__file__), 'data', 'secure_patterns.json')
    try:
        with open(patterns_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load secure patterns: {e}")
        return {"categories": [], "patterns": []}

secure_patterns_data = _load_secure_patterns()
print(f"Loaded {len(secure_patterns_data.get('patterns', []))} secure code patterns")

# --- GLOBAL ERROR HANDLERS ---

@app.errorhandler(400)
def bad_request(e):
    logger.warning(f'Bad request: {str(e)}')
    return jsonify({'error': 'Bad request', 'error_code': 'BAD_REQUEST', 'details': str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found', 'error_code': 'NOT_FOUND'}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed', 'error_code': 'METHOD_NOT_ALLOWED'}), 405

@app.errorhandler(413)
def request_entity_too_large(e):
    log_security_event('FILE_TOO_LARGE', f'Upload exceeded max size from {request.remote_addr}', ip_address=request.remote_addr)
    return jsonify({
        'error': 'File too large. Maximum upload size is 50 MB.',
        'error_code': 'FILE_TOO_LARGE'
    }), 413

@app.errorhandler(500)
def internal_server_error(e):
    logger.error(f'Internal server error: {str(e)}', exc_info=True)
    return jsonify({
        'error': 'An internal server error occurred. Please try again later.',
        'error_code': 'INTERNAL_ERROR'
    }), 500

@app.errorhandler(ValidationError)
def handle_validation_error(e):
    logger.warning(f'Validation error: {e.message}')
    return jsonify(e.to_dict()), 400

# --- REQUEST LOGGING MIDDLEWARE ---

@app.before_request
def before_request_logging():
    """Log incoming requests and attach request timing."""
    g.request_start_time = time.time()
    # Skip logging for static assets and health checks
    if request.path.startswith('/api/'):
        logger.debug(f'{request.method} {request.path} from {request.remote_addr}')

@app.after_request
def after_request_logging(response):
    """Log response details and add rate limit headers."""
    if request.path.startswith('/api/'):
        duration_ms = round((time.time() - getattr(g, 'request_start_time', time.time())) * 1000, 2)
        logger.info(
            f'{request.method} {request.path} -> {response.status_code} ({duration_ms}ms)'
        )

        # Add rate limit info if available
        if hasattr(g, 'rate_limit_info'):
            add_rate_limit_headers(response, g.rate_limit_info)

    return response

# --- RATE LIMIT STATUS ENDPOINT ---

@app.route('/api/rate-limit/status', methods=['GET'])
@token_required
def get_rate_limit_status(current_user):
    """Get the current user's rate limit status."""
    try:
        # Admin users have unlimited scans
        if current_user.is_admin:
            return jsonify({
                'user_id': current_user.id,
                'tier': 'admin',
                'scan_count': 0,
                'daily_limit': -1,
                'remaining_scans': -1,
                'reset_date': None,
                'is_limited': False,
            }), 200
        
        rate_limit = get_or_create_rate_limit(db, RateLimit, current_user.id)
        return jsonify(rate_limit.to_dict()), 200
    except Exception as e:
        logger.error(f'Error fetching rate limit status: {e}')
        return jsonify({'error': 'Could not fetch rate limit status'}), 500

@app.route('/api/admin/rate-limits', methods=['GET'])
@admin_required
def admin_get_rate_limits(current_user):
    """Get all rate limits (admin only)."""
    try:
        rate_limits = RateLimit.query.all()
        return jsonify({
            'rate_limits': [rl.to_dict() for rl in rate_limits],
            'tiers': SCAN_LIMITS
        }), 200
    except Exception as e:
        logger.error(f'Error fetching rate limits: {e}')
        return jsonify({'error': 'Could not fetch rate limits'}), 500

@app.route('/api/admin/rate-limits/<int:user_id>', methods=['PUT'])
@admin_required
def admin_update_rate_limit(current_user, user_id):
    """Update a user's rate limit tier (admin only)."""
    try:
        data = request.get_json()
        tier = data.get('tier', 'free')
        if tier not in SCAN_LIMITS:
            return jsonify({'error': f'Invalid tier. Must be one of: {list(SCAN_LIMITS.keys())}'}), 400
        
        rate_limit = get_or_create_rate_limit(db, RateLimit, user_id)
        rate_limit.tier = tier
        db.session.commit()
        
        logger.info(f'Admin {current_user.id} updated tier for user {user_id} to {tier}')
        return jsonify(rate_limit.to_dict()), 200
    except Exception as e:
        logger.error(f'Error updating rate limit: {e}')
        return jsonify({'error': 'Could not update rate limit'}), 500

# --- ERROR LOG ENDPOINT (Admin) ---

@app.route('/api/admin/error-logs', methods=['GET'])
@admin_required
def admin_get_error_logs(current_user):
    """Get recent error logs (admin only)."""
    try:
        log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs', 'error.log')
        if not os.path.exists(log_file):
            return jsonify({'logs': [], 'message': 'No error logs found'}), 200
        
        lines_to_read = request.args.get('lines', 100, type=int)
        lines_to_read = min(lines_to_read, 500)  # Cap at 500 lines
        
        with open(log_file, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines_to_read:]
        
        logs = []
        for line in recent_lines:
            try:
                log_entry = json.loads(line.strip())
                logs.append(log_entry)
            except json.JSONDecodeError:
                logs.append({'raw': line.strip()})
        
        return jsonify({
            'logs': logs,
            'total_lines': len(all_lines),
            'returned_lines': len(logs)
        }), 200
    except Exception as e:
        logger.error(f'Error reading error logs: {e}')
        return jsonify({'error': 'Could not read error logs'}), 500

# --- CACHE ENDPOINTS ---

@app.route('/api/cache/stats', methods=['GET'])
@admin_required
def get_cache_stats(current_user):
    """Get cache statistics (admin only)."""
    stats = scan_cache.get_stats()
    entries = scan_cache.get_entries_info(limit=20)
    return jsonify({'stats': stats, 'recent_entries': entries}), 200

@app.route('/api/cache/clear', methods=['POST'])
@admin_required
def clear_cache(current_user):
    """Clear all cached scan results (admin only)."""
    count = scan_cache.clear()
    logger.info(f'Cache cleared by admin {current_user.id}: {count} entries removed')
    return jsonify({'message': f'Cache cleared. {count} entries removed.', 'removed': count}), 200

@app.route('/api/cache/invalidate', methods=['POST'])
@admin_required
def invalidate_cache_entry(current_user):
    """Invalidate a specific cache entry or model version (admin only)."""
    data = request.get_json()
    if data.get('model_version'):
        removed = scan_cache.invalidate_by_model(data['model_version'])
        return jsonify({'message': f'{removed} entries invalidated for model {data["model_version"]}', 'removed': removed}), 200
    elif data.get('cache_key'):
        existed = scan_cache.invalidate(data['cache_key'])
        return jsonify({'message': 'Entry invalidated' if existed else 'Entry not found', 'existed': existed}), 200
    else:
        return jsonify({'error': 'Provide model_version or cache_key'}), 400

@app.route('/api/cache/cleanup', methods=['POST'])
@admin_required
def cleanup_cache(current_user):
    """Remove expired cache entries (admin only)."""
    removed = scan_cache.cleanup_expired()
    return jsonify({'message': f'{removed} expired entries cleaned up', 'removed': removed}), 200

# Get current model name for cache keys
def get_model_version():
    """Get current AI model version string for cache keys."""
    try:
        return model._model_name if hasattr(model, '_model_name') else 'default'
    except Exception:
        return 'default'

def extract_code_snippet(full_code, line_number, issue_description, file_path):
    """Extract a context-rich code snippet around the vulnerability."""
    if not full_code:
        return ""
    
    lines = full_code.split('\n')
    total_lines = len(lines)
    
    # If the file is small, keep the entire file for complete context
    if total_lines <= 100:
        return full_code
    
    # If we have a line number, extract a 40-line window around it
    if line_number is not None:
        try:
            line_idx = int(line_number) - 1
            if 0 <= line_idx < total_lines:
                start = max(0, line_idx - 20)
                end = min(total_lines, line_idx + 21)
                return '\n'.join(lines[start:end])
        except (ValueError, TypeError):
            pass
            
    # Fallback to keyword context matching
    try:
        from fix_generator import _extract_code_context
        return _extract_code_context(full_code, issue_description, file_path)
    except Exception:
        # Final fallback
        return '\n'.join(lines[:100])

# --- NEW: PER-FILE SCANNING LOGIC ---

def get_code_files(root_path):
    """Generator function to yield the path and content of each code file."""
    for subdir, _, files in os.walk(root_path):
        for file in files:
            if file.endswith(('.py', '.js', '.html', '.css', '.java', '.c', '.cpp', '.go', '.rs', '.ts','.c++','.php','.rb','.go',)):
                try:
                    file_path = os.path.join(subdir, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        relative_path = os.path.relpath(file_path, root_path)
                        yield relative_path, content
                except Exception:
                    continue

# Store temporary scan data for streaming
scan_sessions = {}

# Track active scan sessions for cancel support
active_scans = {}  # session_id -> {'cancelled': False}

@app.route('/api/scan/stream', methods=['POST'])
@limiter.limit("10 per minute")
@token_required
@scan_rate_limit_required(db, RateLimit)
def scan_code_stream(current_user):
    """Scan code with streaming progress - requires authentication"""
    if not model:
        return jsonify({"error": "Gemini API is not configured. Check your API key."}), 500
    
    import uuid
    session_id = str(uuid.uuid4())
    
    start_time = time.time()
    temp_dir = None 
    scan_type = None
    source_identifier = None 
    
    try:
        # --- INPUT VALIDATION ---
        try:
            validated = validate_scan_request(request)
        except ValidationError as ve:
            logger.warning(f'Scan validation failed for user {current_user.id}: {ve.message}')
            return jsonify(ve.to_dict()), 400

        temp_dir = tempfile.mkdtemp() 
        scan_path = temp_dir

        if validated['scan_type'] == 'zip':
            file = validated['file']
            scan_type = 'zip'
            source_identifier = file.filename
            zip_path = os.path.join(temp_dir, file.filename)
            file.save(zip_path)
            
            # Validate ZIP contents (ZIP bomb detection, blocked files)
            try:
                validate_zip_contents(zip_path)
            except ValidationError as ve:
                logger.warning(f'ZIP validation failed: {ve.message}')
                shutil.rmtree(temp_dir, onerror=remove_readonly)
                return jsonify(ve.to_dict()), 400
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
        
        elif validated['scan_type'] == 'github':
            url = validated['url']
            scan_type = 'github'
            source_identifier = url
            git.Repo.clone_from(url, temp_dir)
            
        else:
            return jsonify({"error": "Invalid input. Provide a ZIP file or GitHub URL."}), 400

        # Increment scan count after successful validation
        rate_info = increment_scan_count(db, RateLimit, current_user.id)
        g.rate_limit_info = rate_info

        items_in_temp = os.listdir(temp_dir)
        potential_folders = [item for item in items_in_temp if os.path.isdir(os.path.join(temp_dir, item))]

        if len(potential_folders) == 1:
            scan_path = os.path.join(temp_dir, potential_folders[0])
        else:
            scan_path = temp_dir
        
        # Discover all files first
        files_to_scan = list(get_code_files(scan_path))
        file_list = [f[0] for f in files_to_scan]
        
        logger.info(f'Scan started by user {current_user.id}: {scan_type} - {source_identifier} ({len(file_list)} files)')
        
        # Day 3: Get scan mode from request
        scan_mode = 'deep'
        if request.is_json and request.json.get('scan_mode') in ('quick', 'deep'):
            scan_mode = request.json['scan_mode']
        elif request.form.get('scan_mode') in ('quick', 'deep'):
            scan_mode = request.form['scan_mode']
        
        # Store session data
        scan_sessions[session_id] = {
            'files': files_to_scan,
            'file_list': file_list,
            'temp_dir': temp_dir,
            'scan_path': scan_path,
            'scan_type': scan_type,
            'source_identifier': source_identifier,
            'start_time': start_time,
            'user_id': current_user.id,
            'scan_mode': scan_mode
        }
        
        # Register for cancel support
        active_scans[session_id] = {'cancelled': False}
        
        response_data = {
            "session_id": session_id,
            "files_to_scan": file_list,
            "total_files": len(file_list),
            "rate_limit": rate_info,
            "scan_mode": scan_mode
        }
        
        return jsonify(response_data)
        
    except ValidationError as ve:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, onerror=remove_readonly)
        return jsonify(ve.to_dict()), 400
    except Exception as e:
        logger.error(f'Scan stream error for user {current_user.id}: {str(e)}', exc_info=True)
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, onerror=remove_readonly)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/scan/process/<session_id>', methods=['GET'])
def process_scan_stream(session_id):
    """Process the actual scan with SSE streaming progress"""
    # Get token from query params for SSE
    token = request.args.get('token')
    if not token:
        return jsonify({"error": "Token is missing"}), 401
    
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        current_user = User.query.get(payload['user_id'])
        if not current_user:
            return jsonify({"error": "User not found"}), 401
        user_id = current_user.id  # Store user_id for use in generator
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    
    if session_id not in scan_sessions:
        return jsonify({"error": "Invalid or expired session"}), 400
    
    session = scan_sessions[session_id]
    
    if session['user_id'] != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    
    def generate():
        temp_dir = session['temp_dir']
        try:
            with app.app_context():  # Create application context for database operations
                files_to_scan = session['files']
                scan_type = session['scan_type']
                source_identifier = session['source_identifier']
                start_time = session['start_time']
                model_version = get_model_version()
                scan_mode = session.get('scan_mode', 'deep')
                
                all_issues = []
                total_files_scanned = 0
                all_files_content = {}
                total_complexity = 0
                scanned_file_list = session['file_list']
                total_files = len(files_to_scan)
                cache_hits = 0
                cache_misses = 0
                file_times = []  # Track time per file for ETA
                
                for idx, (file_path, content) in enumerate(files_to_scan):
                    # Check if scan was cancelled
                    if active_scans.get(session_id, {}).get('cancelled', False):
                        yield f"data: {json.dumps({'type': 'cancelled', 'message': 'Scan cancelled by user', 'files_completed': total_files_scanned, 'total_files': total_files})}\n\n"
                        return
                    
                    file_start_time = time.time()
                    
                    # Calculate ETA based on average time per file
                    avg_time_per_file = (sum(file_times) / len(file_times)) if file_times else 5.0
                    remaining_files = total_files - idx
                    eta_seconds = avg_time_per_file * remaining_files
                    
                    # Send enhanced "scanning" status
                    yield f"data: {json.dumps({'type': 'scanning', 'file': file_path, 'index': idx, 'total': total_files, 'issues_found': len(all_issues), 'eta_seconds': round(eta_seconds, 1), 'cache_hits': cache_hits, 'cache_misses': cache_misses})}\n\n"
                    
                    total_files_scanned += 1
                    all_files_content[file_path] = content
                    
                    file_complexity = calculate_cyclomatic_complexity(content, file_path)
                    total_complexity += file_complexity
                    
                    print(f"Scanning file: {file_path} (complexity: {file_complexity:.2f})")
                    
                    # --- CACHING: Check cache before AI call ---
                    cached_issues, cache_hit, cache_key, file_hash = get_cached_scan_result(content, model_version)
                    
                    if cache_hit:
                        cache_hits += 1
                        for issue in cached_issues:
                            issue_copy = dict(issue)
                            issue_copy["file"] = file_path
                            issue_copy["cached"] = True
                            issue_copy["code_snippet"] = extract_code_snippet(content, issue_copy.get('line_number'), issue_copy.get('description', ''), file_path)
                            all_issues.append(issue_copy)
                        print(f"  Cache HIT for {file_path}")
                    else:
                        cache_misses += 1
                        prompt = get_scan_prompt(file_path, content, scan_mode)
                        
                        try:
                            response = model.generate_content(prompt)
                            cleaned_response_text = response.text.strip().replace("```json", "").replace("```", "")
                            data = json.loads(cleaned_response_text)
                            
                            file_issues = data.get("issues", [])
                            
                            # Store in cache (without file path, since it's content-based)
                            store_scan_result(cache_key, file_issues)
                            
                            for issue in file_issues:
                                issue["file"] = file_path
                                issue["code_snippet"] = extract_code_snippet(content, issue.get('line_number'), issue.get('description', ''), file_path)
                                all_issues.append(issue)
                            
                            time.sleep(4)

                        except Exception as api_error:
                            print(f"Could not process {file_path}: {api_error}")
                    
                    file_elapsed = time.time() - file_start_time
                    file_times.append(file_elapsed)
                    
                    # Send enhanced "completed" status
                    yield f"data: {json.dumps({'type': 'completed', 'file': file_path, 'index': idx, 'total': total_files, 'issues_found': len(all_issues), 'cached': cache_hit, 'file_time': round(file_elapsed, 1)})}\n\n"

                # Check cancel one more time before finalizing
                if active_scans.get(session_id, {}).get('cancelled', False):
                    yield f"data: {json.dumps({'type': 'cancelled', 'message': 'Scan cancelled by user', 'files_completed': total_files_scanned, 'total_files': total_files})}\n\n"
                    return

                # Calculate metrics
                avg_complexity = total_complexity / max(total_files_scanned, 1)
                duplication_percentage = calculate_code_duplication(all_files_content)
                vulnerable_dependencies = scan_dependencies_vulnerabilities(session['scan_path'])
                
                complexity_penalty = min(avg_complexity * 2, 30)
                duplication_penalty = min(duplication_percentage * 0.5, 25)
                issues_penalty = min(len(all_issues) * 3, 35)
                vuln_deps_penalty = min(vulnerable_dependencies * 5, 10)
                
                overall_score = max(0, 100 - complexity_penalty - duplication_penalty - issues_penalty - vuln_deps_penalty)
                
                scan_duration = time.time() - start_time
                
                final_report = {
                    "scan_info": f"Successfully scanned {total_files_scanned} files in {scan_duration:.1f} seconds.",
                    "overall_score": round(overall_score, 1),
                    "metrics": {
                        "code_complexity": round(avg_complexity, 2),
                        "duplication_percentage": round(duplication_percentage, 1),
                        "vulnerable_dependencies": vulnerable_dependencies
                    },
                    "files_scanned": total_files_scanned,
                    "scanned_files": scanned_file_list,
                    "scan_duration": round(scan_duration, 1),
                    "issues": all_issues,
                    "scan_mode": scan_mode,
                    "cache_stats": {
                        "hits": cache_hits,
                        "misses": cache_misses,
                        "hit_rate": round(cache_hits / max(cache_hits + cache_misses, 1) * 100, 1)
                    }
                }

                # Day 4: Enrich with prioritization + feedback confidence
                try:
                    final_report["issues"] = prioritize_issues(all_issues)
                    final_report["issues"] = feedback_processor.enrich_issues_with_feedback(final_report["issues"])
                    final_report["fix_first"] = get_fix_first_top_n(all_issues, 3)
                    final_report["risk_matrix"] = get_risk_matrix_summary(all_issues)
                except Exception as enrich_err:
                    print(f"Issue enrichment warning: {enrich_err}")
                
                scan_id = save_scan_to_database(final_report, scan_type, source_identifier, scan_duration, user_id)
                
                if scan_id:
                    final_report["scan_id"] = scan_id

                # Send final result
                yield f"data: {json.dumps({'type': 'result', 'data': final_report})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            # Cleanup
            if session_id in scan_sessions:
                del scan_sessions[session_id]
            if session_id in active_scans:
                del active_scans[session_id]
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, onerror=remove_readonly)
    
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    })

@app.route('/api/scan/cancel/<session_id>', methods=['POST'])
@token_required
def cancel_scan(current_user, session_id):
    """Cancel an active scan session."""
    if session_id not in scan_sessions:
        return jsonify({"error": "Session not found or already completed"}), 404
    
    session = scan_sessions[session_id]
    if session['user_id'] != current_user.id and not current_user.is_admin:
        return jsonify({"error": "Unauthorized"}), 403
    
    if session_id in active_scans:
        active_scans[session_id]['cancelled'] = True
        logger.info(f'Scan {session_id} cancelled by user {current_user.id}')
        return jsonify({"message": "Scan cancellation requested", "session_id": session_id}), 200
    
    return jsonify({"error": "Scan not found in active sessions"}), 404

# --- Day 3: Quick/Deep Scan Mode Prompts ---

QUICK_SCAN_PROMPT = """You are a security auditor performing a QUICK SCAN focused on OWASP Top 10 vulnerabilities only.
Check ONLY for these critical issues:
1. SQL Injection
2. Cross-Site Scripting (XSS)
3. Hardcoded Secrets/Credentials
4. Insecure Authentication
5. Broken Access Control
6. Security Misconfiguration
7. Insecure Deserialization
8. Insufficient Logging
9. Server-Side Request Forgery (SSRF)
10. Using Components with Known Vulnerabilities

Provide your response as a JSON object with a single key "issues", which is an array of issue objects.
Each issue object must have keys "severity", "description", and "suggestion".
If no issues are found, return an empty array: {{"issues": []}}.
Do not include any text outside the JSON object.

Code to analyze from file '{file_path}':
---
{content}
---
"""

DEEP_SCAN_PROMPT = """You are a security auditor. Analyze only the code snippet below for security vulnerabilities.
Provide your response as a JSON object with a single key "issues", which is an array of issue objects.
Each issue object must have keys "severity", "description", and "suggestion".
If no issues are found, return an empty array: {{"issues": []}}.
Do not include any text outside the JSON object.

Code to analyze from file '{file_path}':
---
{content}
---
"""

def get_scan_prompt(file_path, content, scan_mode='deep'):
    """Get the appropriate AI prompt based on scan mode."""
    if scan_mode == 'quick':
        return QUICK_SCAN_PROMPT.format(file_path=file_path, content=content)
    return DEEP_SCAN_PROMPT.format(file_path=file_path, content=content)

# --- Day 3: Language to file extension mapping ---
LANGUAGE_EXTENSIONS = {
    'python': '.py', 'javascript': '.js', 'typescript': '.ts', 'java': '.java',
    'c': '.c', 'cpp': '.cpp', 'csharp': '.cs', 'go': '.go', 'rust': '.rs',
    'php': '.php', 'ruby': '.rb', 'swift': '.swift', 'kotlin': '.kt',
    'scala': '.scala', 'html': '.html', 'css': '.css', 'sql': '.sql',
    'shell': '.sh', 'yaml': '.yaml', 'xml': '.xml', 'json': '.json',
    'dart': '.dart', 'r': '.r', 'perl': '.pl',
}

# --- Day 3: Direct Code Paste Scanning ---

@app.route('/api/scan/direct', methods=['POST'])
@limiter.limit("15 per minute")
@token_required
@scan_rate_limit_required(db, RateLimit)
def scan_direct_code(current_user):
    """Scan directly pasted code - single file, fast response."""
    if not model:
        return jsonify({"error": "Gemini API is not configured. Check your API key."}), 500
    
    start_time = time.time()
    
    try:
        data = request.get_json()
        if not data or not data.get('code'):
            return jsonify({"error": "Code content is required"}), 400
        
        code = sanitize_string(data['code'], max_length=100000)
        language = sanitize_string(data.get('language', 'python'), max_length=50)
        scan_mode = data.get('scan_mode', 'deep')
        
        if scan_mode not in ('quick', 'deep'):
            scan_mode = 'deep'
        
        if not code.strip():
            return jsonify({"error": "Code content cannot be empty"}), 400
        
        # Determine file extension from language
        ext = LANGUAGE_EXTENSIONS.get(language, '.txt')
        file_name = f'pasted_code{ext}'
        
        # Increment scan count
        rate_info = increment_scan_count(db, RateLimit, current_user.id)
        g.rate_limit_info = rate_info
        
        logger.info(f'Direct code scan by user {current_user.id}: {language}, mode={scan_mode}, {len(code)} chars')
        
        # Calculate metrics for single file
        file_complexity = calculate_cyclomatic_complexity(code, file_name)
        
        # Check cache
        model_version = get_model_version()
        cached_issues, cache_hit, cache_key, file_hash = get_cached_scan_result(code, model_version)
        
        all_issues = []
        cache_hits = 0
        cache_misses = 0
        
        if cache_hit:
            cache_hits = 1
            for issue in cached_issues:
                issue_copy = dict(issue)
                issue_copy["file"] = file_name
                issue_copy["cached"] = True
                issue_copy["code_snippet"] = extract_code_snippet(code, issue_copy.get('line_number'), issue_copy.get('description', ''), file_name)
                all_issues.append(issue_copy)
        else:
            cache_misses = 1
            prompt = get_scan_prompt(file_name, code, scan_mode)
            
            try:
                response = model.generate_content(prompt)
                cleaned_response_text = response.text.strip().replace("```json", "").replace("```", "")
                ai_data = json.loads(cleaned_response_text)
                
                file_issues = ai_data.get("issues", [])
                store_scan_result(cache_key, file_issues)
                
                for issue in file_issues:
                    issue["file"] = file_name
                    issue["code_snippet"] = extract_code_snippet(code, issue.get('line_number'), issue.get('description', ''), file_name)
                    all_issues.append(issue)
                    
            except Exception as api_error:
                logger.error(f'AI API error in direct scan: {api_error}')
                return jsonify({"error": f"Could not analyze code: {str(api_error)}"}), 500
        
        scan_duration = time.time() - start_time
        
        # Calculate score
        complexity_penalty = min(file_complexity * 2, 30)
        issues_penalty = min(len(all_issues) * 3, 35)
        overall_score = max(0, 100 - complexity_penalty - issues_penalty)
        
        final_report = {
            "scan_info": f"Direct code scan completed in {scan_duration:.1f} seconds.",
            "overall_score": round(overall_score, 1),
            "metrics": {
                "code_complexity": round(file_complexity, 2),
                "duplication_percentage": 0,
                "vulnerable_dependencies": 0
            },
            "scanned_files": [file_name],
            "files_scanned": 1,
            "scan_duration": round(scan_duration, 1),
            "issues": all_issues,
            "scan_mode": scan_mode,
            "language": language,
            "cache_stats": {
                "hits": cache_hits,
                "misses": cache_misses,
                "hit_rate": round(cache_hits / max(cache_hits + cache_misses, 1) * 100, 1)
            }
        }
        
        # Day 4: Enrich with prioritization + feedback confidence
        try:
            final_report["issues"] = prioritize_issues(all_issues)
            final_report["issues"] = feedback_processor.enrich_issues_with_feedback(final_report["issues"])
            final_report["fix_first"] = get_fix_first_top_n(all_issues, 3)
            final_report["risk_matrix"] = get_risk_matrix_summary(all_issues)
        except Exception as enrich_err:
            logger.warning(f'Issue enrichment warning: {enrich_err}')

        # Save to database
        scan_id = save_scan_to_database(final_report, 'direct_code', f'{language} ({scan_mode})', scan_duration, current_user.id)
        if scan_id:
            final_report["scan_id"] = scan_id
        
        return jsonify(final_report)
        
    except Exception as e:
        logger.error(f'Direct scan error: {str(e)}', exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/api/scan', methods=['POST'])
@limiter.limit("10 per minute")
@token_required
@scan_rate_limit_required(db, RateLimit)
def scan_code(current_user):
    """Scan code - requires authentication"""
    if not model:
        return jsonify({"error": "Gemini API is not configured. Check your API key."}), 500
    
    start_time = time.time()  # Track scan duration
    temp_dir = None 
    scan_type = None
    source_identifier = None 
    try:
        # --- INPUT VALIDATION ---
        has_file = 'file' in request.files and request.files['file'].filename != ''
        has_url = request.is_json and 'github_url' in request.json and request.json['github_url']
        has_code = request.is_json and 'code' in request.json and request.json['code']
        
        temp_dir = tempfile.mkdtemp() 
        scan_path = temp_dir

        if has_file:
            try:
                validate_file_upload(request.files['file'])
            except ValidationError as ve:
                shutil.rmtree(temp_dir, onerror=remove_readonly)
                return jsonify(ve.to_dict()), 400
            
            file = request.files['file']
            scan_type = 'zip'
            source_identifier = file.filename
            zip_path = os.path.join(temp_dir, file.filename)
            file.save(zip_path)
            
            try:
                validate_zip_contents(zip_path)
            except ValidationError as ve:
                shutil.rmtree(temp_dir, onerror=remove_readonly)
                return jsonify(ve.to_dict()), 400
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
        
        elif has_url:
            try:
                url = validate_github_url(request.json['github_url'])
            except ValidationError as ve:
                shutil.rmtree(temp_dir, onerror=remove_readonly)
                return jsonify(ve.to_dict()), 400
            
            scan_type = 'github'
            source_identifier = url
            git.Repo.clone_from(url, temp_dir)
            
        elif has_code:
            # Support direct code scanning for testing
            code = sanitize_string(request.json['code'], max_length=100000)
            scan_type = 'code'
            source_identifier = 'Direct Code Input'
            
            # Create a temporary Python file
            test_file_path = os.path.join(temp_dir, 'test_code.py')
            with open(test_file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            scan_path = temp_dir
            
        else:
            shutil.rmtree(temp_dir, onerror=remove_readonly)
            return jsonify({"error": "Invalid input. Provide a ZIP file, GitHub URL, or code content."}), 400

        # Increment scan count
        rate_info = increment_scan_count(db, RateLimit, current_user.id)
        g.rate_limit_info = rate_info
        
        logger.info(f'Non-streaming scan started by user {current_user.id}: {scan_type} - {source_identifier}')

        items_in_temp = os.listdir(temp_dir)
        potential_folders = [item for item in items_in_temp if os.path.isdir(os.path.join(temp_dir, item))]

        if len(potential_folders) == 1:
            scan_path = os.path.join(temp_dir, potential_folders[0])
        else:
            scan_path = temp_dir
        
        all_issues = []
        total_files_scanned = 0
        all_files_content = {}  # Store all file contents for metrics calculation
        total_complexity = 0
        scanned_file_list = []  # Store list of scanned file names
        cache_hits = 0
        cache_misses = 0
        model_version = get_model_version()
        
        # Loop through each file and send a separate API request
        for file_path, content in get_code_files(scan_path):
            total_files_scanned += 1
            all_files_content[file_path] = content  # Store content for metrics
            scanned_file_list.append(file_path)  # Add to scanned files list
            
            # Calculate complexity for this file
            file_complexity = calculate_cyclomatic_complexity(content, file_path)
            total_complexity += file_complexity
            
            print(f"Scanning file: {file_path} (complexity: {file_complexity:.2f})")
            
            # --- CACHING: Check cache before AI call ---
            cached_issues, cache_hit, cache_key, file_hash = get_cached_scan_result(content, model_version)
            
            if cache_hit:
                cache_hits += 1
                for issue in cached_issues:
                    issue_copy = dict(issue)
                    issue_copy["file"] = file_path
                    issue_copy["cached"] = True
                    all_issues.append(issue_copy)
                print(f"  Cache HIT for {file_path}")
                continue
            
            cache_misses += 1
            prompt = get_scan_prompt(file_path, content, 'deep')
            
            try:
                response = model.generate_content(prompt)
                cleaned_response_text = response.text.strip().replace("```json", "").replace("```", "")
                data = json.loads(cleaned_response_text)
                
                file_issues = data.get("issues", [])
                
                # Store in cache
                store_scan_result(cache_key, file_issues)
                
                # Add the file path to each issue found
                for issue in file_issues:
                    issue["file"] = file_path
                    all_issues.append(issue)
                
                # IMPORTANT: Wait to avoid hitting the RPM (Requests Per Minute) limit
                time.sleep(4) # ~15 requests per minute

            except Exception as api_error:
                print(f"Could not process {file_path}: {api_error}")
                continue # Skip to the next file if one fails

        # --- AGGREGATE FINAL RESULTS ---
        # After scanning all files, create the final report
        
        # Calculate code metrics
        avg_complexity = total_complexity / max(total_files_scanned, 1)
        duplication_percentage = calculate_code_duplication(all_files_content)
        vulnerable_dependencies = scan_dependencies_vulnerabilities(scan_path)
        
        # Calculate overall score based on multiple factors
        complexity_penalty = min(avg_complexity * 2, 30)  # Max 30 points penalty
        duplication_penalty = min(duplication_percentage * 0.5, 25)  # Max 25 points penalty
        issues_penalty = min(len(all_issues) * 3, 35)  # Max 35 points penalty
        vuln_deps_penalty = min(vulnerable_dependencies * 5, 10)  # Max 10 points penalty
        
        overall_score = max(0, 100 - complexity_penalty - duplication_penalty - issues_penalty - vuln_deps_penalty)
        
        # Calculate scan duration
        scan_duration = time.time() - start_time
        
        final_report = {
            "scan_info": f"Successfully scanned {total_files_scanned} files in {scan_duration:.1f} seconds.",
            "overall_score": round(overall_score, 1),
            "metrics": {
                "code_complexity": round(avg_complexity, 2),
                "duplication_percentage": round(duplication_percentage, 1),
                "vulnerable_dependencies": vulnerable_dependencies
            },
            "scanned_files": scanned_file_list,
            "files_scanned": total_files_scanned,
            "scan_duration": round(scan_duration, 1),
            "issues": all_issues,
            "cache_stats": {
                "hits": cache_hits,
                "misses": cache_misses,
                "hit_rate": round(cache_hits / max(cache_hits + cache_misses, 1) * 100, 1)
            }
        }
        
        # Day 4: Enrich with prioritization + feedback confidence
        try:
            final_report["issues"] = prioritize_issues(all_issues)
            final_report["issues"] = feedback_processor.enrich_issues_with_feedback(final_report["issues"])
            final_report["fix_first"] = get_fix_first_top_n(all_issues, 3)
            final_report["risk_matrix"] = get_risk_matrix_summary(all_issues)
        except Exception as enrich_err:
            print(f"Issue enrichment warning: {enrich_err}")

        # Save to database - associate with the authenticated user
        scan_id = save_scan_to_database(final_report, scan_type, source_identifier, scan_duration, current_user.id)
        
        if scan_id:
            final_report["scan_id"] = scan_id

        return jsonify(final_report)

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, onerror=remove_readonly)

# --- NEW API ENDPOINTS ---

# --- CLIENT ERROR LOGGING ENDPOINT ---

@app.route('/api/client-error', methods=['POST'])
@token_required
def log_client_error(current_user):
    """Log client-side errors from the frontend."""
    try:
        data = request.get_json()
        logger.error(
            f'Client error from user {current_user.id}: {data.get("error", "Unknown")}',
            extra={
                'user_id': current_user.id,
                'ip_address': request.remote_addr,
                'client_url': data.get('url', ''),
                'user_agent': data.get('userAgent', ''),
            }
        )
        return jsonify({'message': 'Error logged'}), 200
    except Exception as e:
        return jsonify({'error': 'Could not log error'}), 500

# --- AUTHENTICATION ENDPOINTS ---

@app.route('/api/auth/check-availability', methods=['POST'])
@limiter.limit("20 per minute")
def check_availability():
    """Check if username or email is already taken"""
    try:
        data = request.get_json()
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip().lower()
        result = {}

        if username:
            existing = User.query.filter(func.lower(User.username) == username.lower()).first()
            if existing:
                result['username'] = {'available': False, 'message': 'This username is already taken by someone. Please choose a different username.'}
            else:
                result['username'] = {'available': True, 'message': 'Username is available'}

        if email:
            existing = User.query.filter(func.lower(User.email) == email).first()
            if existing:
                result['email'] = {'available': False, 'message': 'This email is already registered. Please sign in instead.'}
            else:
                result['email'] = {'available': True, 'message': 'Email is available'}

        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/send-verification', methods=['POST'])
@limiter.limit("5 per minute")
def send_email_verification():
    """Send an OTP to verify email before registration"""
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip().lower()

        if not email:
            return jsonify({'error': 'Email is required'}), 400

        # Check if email is already registered
        existing = User.query.filter(func.lower(User.email) == email).first()
        if existing:
            return jsonify({'error': 'This email is already registered. Please sign in instead.'}), 400

        # Invalidate previous unused tokens for this email
        EmailVerificationToken.query.filter_by(email=email, used=False).update({'used': True})

        otp = generate_otp()
        token_record = EmailVerificationToken(
            email=email,
            token=otp,
            expires_at=datetime.utcnow() + timedelta(minutes=15)
        )
        db.session.add(token_record)
        db.session.commit()

        # Send via SMTP
        success, err_msg = send_otp_email(email, otp, purpose='verification')
        if not success:
            logger.error(f"Failed to send verification email to {email}: {err_msg}")
            return jsonify({'error': f'Failed to send verification email: {err_msg}'}), 500

        logger.info(f"Email verification OTP sent to {email}")
        return jsonify({
            'message': 'Verification code sent to your email.',
            'expires_in_minutes': 15
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify-email', methods=['POST'])
@limiter.limit("10 per minute")
def verify_email_otp():
    """Verify the email OTP code"""
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip().lower()
        code = (data.get('code') or '').strip()

        if not email or not code:
            return jsonify({'error': 'Email and verification code are required'}), 400

        token_record = EmailVerificationToken.query.filter_by(
            email=email, token=code, used=False
        ).first()

        if not token_record or token_record.is_expired():
            return jsonify({'error': 'Invalid or expired verification code'}), 400

        # Mark as verified (but not yet used â€” used when register completes)
        token_record.verified = True
        db.session.commit()

        logger.info(f"Email {email} verified successfully")
        return jsonify({'message': 'Email verified successfully.', 'verified': True}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    """Register a new user (requires verified email)"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('username') or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Username, email, and password are required'}), 400

        email = data['email'].strip().lower()

        # Validate password strength
        password = data['password']
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400

        # Check that email was verified
        verified_token = EmailVerificationToken.query.filter_by(
            email=email, verified=True, used=False
        ).first()
        if not verified_token:
            return jsonify({'error': 'Email not verified. Please verify your email first.'}), 400

        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == data['username']) | (func.lower(User.email) == email)
        ).first()

        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 400

        # Create new user
        user = User(
            username=data['username'],
            email=email,
            is_admin=False
        )
        user.set_password(password)

        # Mark verification token as used
        verified_token.used = True

        db.session.add(user)
        db.session.commit()

        # Generate token for the new user
        token = generate_token(user.id, user.is_admin)

        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict(),
            'token': token
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Login with username/email and password"""
    try:
        data = request.get_json()
        
        if not data.get('login') or not data.get('password'):
            return jsonify({'error': 'Login (username or email) and password are required'}), 400
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == data['login']) | (User.email == data['login'])
        ).first()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 401
        
        if not user.check_password(data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate token
        token = generate_token(user.id, user.is_admin)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'token': token
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password():
    """Request a password reset OTP"""
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip().lower()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        user = User.query.filter(func.lower(User.email) == email).first()
        
        if not user:
            # Don't reveal whether the email exists
            return jsonify({
                'message': 'If an account with that email exists, a reset code has been generated.',
                'reset_code': None
            }), 200
        
        if not user.is_active:
            return jsonify({
                'message': 'If an account with that email exists, a reset code has been generated.',
                'reset_code': None
            }), 200
        
        # Invalidate any existing unused tokens for this user
        PasswordResetToken.query.filter_by(user_id=user.id, used=False).update({'used': True})
        
        otp = generate_otp()
        
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=otp,
            expires_at=datetime.utcnow() + timedelta(minutes=15)
        )
        db.session.add(reset_token)
        db.session.commit()
        
        # Send OTP via email
        success, err_msg = send_otp_email(user.email, otp, purpose='password_reset')
        if not success:
            logger.error(f"Failed to send password reset email to {user.email}: {err_msg}")
            return jsonify({'error': f'Failed to send reset email: {err_msg}'}), 500
        
        logger.info(f"Password reset OTP sent to {user.email} for user {user.username} (ID: {user.id})")
        
        return jsonify({
            'message': 'A password reset code has been sent to your email.',
            'expires_in_minutes': 15
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/verify-reset-code', methods=['POST'])
@limiter.limit("10 per minute")
def verify_reset_code():
    """Verify the password reset OTP code (without resetting password yet)"""
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip().lower()
        code = (data.get('code') or '').strip()

        if not email or not code:
            return jsonify({'error': 'Email and reset code are required'}), 400

        user = User.query.filter(func.lower(User.email) == email).first()
        if not user:
            return jsonify({'error': 'Invalid reset code'}), 400

        reset_token = PasswordResetToken.query.filter_by(
            user_id=user.id, token=code, used=False
        ).first()

        if not reset_token or reset_token.is_expired():
            return jsonify({'error': 'Invalid or expired reset code'}), 400

        return jsonify({'message': 'Code verified successfully.', 'verified': True}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
@limiter.limit("10 per minute")
def reset_password():
    """Reset password using OTP code"""
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip().lower()
        code = (data.get('code') or '').strip()
        new_password = data.get('new_password', '')
        
        if not email or not code or not new_password:
            return jsonify({'error': 'Email, reset code, and new password are required'}), 400
        
        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters long'}), 400
        
        user = User.query.filter(func.lower(User.email) == email).first()
        if not user:
            return jsonify({'error': 'Invalid reset code or email'}), 400
        
        # Find a valid, unused, non-expired token
        reset_token = PasswordResetToken.query.filter_by(
            user_id=user.id,
            token=code,
            used=False
        ).first()
        
        if not reset_token or reset_token.is_expired():
            return jsonify({'error': 'Invalid or expired reset code'}), 400
        
        # Mark token as used
        reset_token.used = True
        
        # Update password
        user.set_password(new_password)
        db.session.commit()
        
        logger.info(f"Password reset successful for user {user.username} (ID: {user.id})")
        
        return jsonify({'message': 'Password reset successful. You can now login with your new password.'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Get current authenticated user info"""
    return jsonify({
        'user': current_user.to_dict()
    }), 200

@app.route('/api/auth/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    """Change user's password"""
    try:
        data = request.get_json()
        
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        if not current_user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        if len(data['new_password']) < 8:
            return jsonify({'error': 'New password must be at least 8 characters long'}), 400
        
        current_user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- ADMIN ENDPOINTS ---

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_list_users(current_user):
    """List all users (admin only)"""
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users],
            'total': len(users)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
@admin_required
def admin_get_user(current_user, user_id):
    """Get user details (admin only)"""
    user = User.query.get_or_404(user_id)
    return jsonify({'user': user.to_dict()}), 200

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required
def admin_update_user(current_user, user_id):
    """Update user details (admin only)"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'is_admin' in data:
            # Prevent removing own admin access
            if user.id == current_user.id and not data['is_admin']:
                return jsonify({'error': 'Cannot remove your own admin access'}), 400
            user.is_admin = data['is_admin']
        
        db.session.commit()
        return jsonify({'user': user.to_dict(), 'message': 'User updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(current_user, user_id):
    """Delete a user (admin only)"""
    try:
        if user_id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dashboard', methods=['GET'])
@admin_required
def admin_dashboard(current_user):
    """Get admin dashboard statistics"""
    try:
        # User statistics
        total_users = User.query.count()
        active_users = User.query.filter(User.is_active == True).count()
        admin_users = User.query.filter(User.is_admin == True).count()
        
        # Get users registered in last 7 days
        week_ago = datetime.utcnow() - timedelta(days=7)
        new_users_this_week = User.query.filter(User.created_at >= week_ago).count()
        
        # Scan statistics
        total_scans = ScanHistory.query.count()
        scans_this_week = ScanHistory.query.filter(ScanHistory.created_at >= week_ago).count()
        avg_score = db.session.query(func.avg(ScanHistory.overall_score)).scalar() or 0
        
        # Total issues found
        total_issues = db.session.query(func.sum(ScanHistory.total_issues)).scalar() or 0
        critical_issues = db.session.query(func.sum(ScanHistory.critical_issues)).scalar() or 0
        high_issues = db.session.query(func.sum(ScanHistory.high_issues)).scalar() or 0
        
        # Recent scans
        recent_scans = ScanHistory.query.order_by(ScanHistory.created_at.desc()).limit(10).all()
        
        # Recent users
        recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()
        
        # Scans per day (last 7 days)
        scans_per_day = []
        for i in range(7):
            day = datetime.utcnow() - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            count = ScanHistory.query.filter(
                ScanHistory.created_at >= day_start,
                ScanHistory.created_at < day_end
            ).count()
            scans_per_day.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'count': count
            })
        
        return jsonify({
            'users': {
                'total': total_users,
                'active': active_users,
                'admins': admin_users,
                'new_this_week': new_users_this_week
            },
            'scans': {
                'total': total_scans,
                'this_week': scans_this_week,
                'average_score': round(avg_score, 1),
                'per_day': scans_per_day[::-1]  # Reverse to show oldest first
            },
            'issues': {
                'total': int(total_issues),
                'critical': int(critical_issues),
                'high': int(high_issues)
            },
            'recent_scans': [scan.to_dict() for scan in recent_scans],
            'recent_users': [user.to_dict() for user in recent_users]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/all-scans', methods=['GET'])
@admin_required
def admin_get_all_scans(current_user):
    """Get all scans (admin only)"""
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        scans = ScanHistory.query.order_by(ScanHistory.created_at.desc()).offset(offset).limit(limit).all()
        total = ScanHistory.query.count()
        
        return jsonify({
            'scans': [scan.to_dict() for scan in scans],
            'total': total
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- USER ENDPOINTS ---

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        
        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == data['username']) | (User.email == data['email'])
        ).first()
        
        if existing_user:
            return jsonify({"error": "Username or email already exists"}), 400
        
        user = User(
            username=data['username'],
            email=data['email']
        )
        user.set_password(data.get('password', 'defaultpassword123'))
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify(user.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['GET'])
@token_required
def get_user(current_user, user_id):
    """Get user information"""
    # Users can only view their own profile unless admin
    if current_user.id != user_id and not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())

@app.route('/api/users', methods=['GET'])
@admin_required
def list_users(current_user):
    """List all users (for admin purposes)"""
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

@app.route('/api/scans', methods=['GET'])
@token_required
def get_scan_history(current_user):
    """Get scan history for the authenticated user"""
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # Users can only see their own scans (admins can see all via admin endpoint)
        query = ScanHistory.query.filter(ScanHistory.user_id == current_user.id)
        
        scans = query.order_by(ScanHistory.created_at.desc()).offset(offset).limit(limit).all()
        
        return jsonify({
            "scans": [scan.to_dict() for scan in scans],
            "total": query.count()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/scans/<int:scan_id>', methods=['GET'])
@token_required
def get_scan_details(current_user, scan_id):
    """Get detailed scan information including issues - user can only view their own scans"""
    try:
        scan = ScanHistory.query.get_or_404(scan_id)
        
        # Check if user owns this scan or is admin
        if scan.user_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Access denied"}), 403
        
        scan_data = scan.to_dict()
        
        # Add issues to the response
        issues = ScanIssue.query.filter(ScanIssue.scan_id == scan_id).all()
        scan_data['issues'] = [issue.to_dict() for issue in issues]
        
        return jsonify(scan_data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/scans/<int:scan_id>', methods=['DELETE'])
@token_required
def delete_scan(current_user, scan_id):
    """Delete a scan and its associated issues - user can only delete their own scans"""
    try:
        scan = ScanHistory.query.get_or_404(scan_id)
        
        # Check if user owns this scan or is admin
        if scan.user_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Access denied"}), 403
        
        db.session.delete(scan)
        db.session.commit()
        
        return jsonify({"message": "Scan deleted successfully"})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics/overview', methods=['GET'])
@token_required
def get_analytics_overview(current_user):
    """Get analytics overview for the authenticated user"""
    try:
        # Use authenticated user's ID
        user_id = current_user.id
        
        # Base query
        query = ScanHistory.query
        if user_id:
            query = query.filter(ScanHistory.user_id == user_id)
        
        # Calculate statistics
        total_scans = query.count()
        avg_score = db.session.query(func.avg(ScanHistory.overall_score)).filter(
            ScanHistory.user_id == user_id if user_id else True
        ).scalar() or 0
        
        total_issues = db.session.query(func.sum(ScanHistory.total_issues)).filter(
            ScanHistory.user_id == user_id if user_id else True
        ).scalar() or 0
        
        # Recent scans trend (last 30 days)
        from datetime import datetime, timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        recent_scans = query.filter(ScanHistory.created_at >= thirty_days_ago).all()
        
        # Score trend
        score_trend = [{
            'date': scan.created_at.isoformat(),
            'score': scan.overall_score
        } for scan in recent_scans[-10:]]  # Last 10 scans
        
        # Issue distribution
        issue_distribution = {
            'critical': sum(scan.critical_issues for scan in recent_scans),
            'high': sum(scan.high_issues for scan in recent_scans),
            'medium': sum(scan.medium_issues for scan in recent_scans),
            'low': sum(scan.low_issues for scan in recent_scans)
        }
        
        return jsonify({
            "total_scans": total_scans,
            "average_score": round(avg_score, 1),
            "total_issues_found": int(total_issues),
            "score_trend": score_trend,
            "issue_distribution": issue_distribution,
            "recent_scans_count": len(recent_scans)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics/trends', methods=['GET'])
def get_trends():
    """Get detailed trends and analytics"""
    try:
        user_id = request.args.get('user_id', type=int)
        days = request.args.get('days', 30, type=int)
        
        from datetime import datetime, timedelta
        start_date = datetime.utcnow() - timedelta(days=days)
        
        query = ScanHistory.query.filter(ScanHistory.created_at >= start_date)
        if user_id:
            query = query.filter(ScanHistory.user_id == user_id)
        
        scans = query.order_by(ScanHistory.created_at.asc()).all()
        
        # Calculate trends
        complexity_trend = [{'date': s.created_at.isoformat(), 'value': s.code_complexity} for s in scans]
        duplication_trend = [{'date': s.created_at.isoformat(), 'value': s.duplication_percentage} for s in scans]
        score_trend = [{'date': s.created_at.isoformat(), 'value': s.overall_score} for s in scans]
        
        return jsonify({
            "complexity_trend": complexity_trend,
            "duplication_trend": duplication_trend,
            "score_trend": score_trend,
            "total_scans_in_period": len(scans)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ===================================================================
# --- Day 4: AI Enhancement Endpoints ---
# ===================================================================

# --- 4.1: Multi-Model AI Comparison ---

@app.route('/api/models', methods=['GET'])
@token_required
def get_available_models(current_user):
    """Get list of available AI models and their stats."""
    return jsonify({
        'models': multi_model_mgr.get_available_models(),
        'cost_comparison': multi_model_mgr.get_cost_comparison(),
    }), 200

@app.route('/api/scan/compare', methods=['POST'])
@limiter.limit("5 per minute")
@token_required
@scan_rate_limit_required(db, RateLimit)
def scan_compare_models(current_user):
    """
    Scan code with multiple AI models and return consensus results.
    Accepts same input as /api/scan/direct but runs on all available models.
    """
    start_time = time.time()

    try:
        data = request.get_json()
        if not data or not data.get('code'):
            return jsonify({"error": "Code content is required"}), 400

        code = sanitize_string(data['code'], max_length=100000)
        language = sanitize_string(data.get('language', 'python'), max_length=50)
        scan_mode = data.get('scan_mode', 'deep')
        model_keys = data.get('models')  # Optional: list of specific models to use

        if scan_mode not in ('quick', 'deep'):
            scan_mode = 'deep'

        if not code.strip():
            return jsonify({"error": "Code content cannot be empty"}), 400

        ext = LANGUAGE_EXTENSIONS.get(language, '.txt')
        file_name = f'pasted_code{ext}'

        # Increment scan count
        rate_info = increment_scan_count(db, RateLimit, current_user.id)
        g.rate_limit_info = rate_info

        logger.info(f'Multi-model comparison scan by user {current_user.id}: {language}, mode={scan_mode}')

        prompt = get_scan_prompt(file_name, code, scan_mode)

        # Run multi-model analysis
        comparison = multi_model_mgr.analyze_multi(prompt, model_keys)

        # Get consensus issues and add file path
        consensus_issues = comparison.get('consensus', {}).get('issues', [])
        for issue in consensus_issues:
            issue['file'] = file_name

        # Enrich with risk scores and feedback-adjusted confidence
        enriched_issues = prioritize_issues(consensus_issues)
        enriched_issues = feedback_processor.enrich_issues_with_feedback(enriched_issues)

        # Calculate score
        file_complexity = calculate_cyclomatic_complexity(code, file_name)
        complexity_penalty = min(file_complexity * 2, 30)
        issues_penalty = min(len(enriched_issues) * 3, 35)
        overall_score = max(0, 100 - complexity_penalty - issues_penalty)

        scan_duration = time.time() - start_time

        result = {
            "scan_info": f"Multi-model comparison completed in {scan_duration:.1f} seconds.",
            "overall_score": round(overall_score, 1),
            "metrics": {
                "code_complexity": round(file_complexity, 2),
                "duplication_percentage": 0,
                "vulnerable_dependencies": 0,
            },
            "scanned_files": [file_name],
            "files_scanned": 1,
            "scan_duration": round(scan_duration, 1),
            "issues": enriched_issues,
            "scan_mode": scan_mode,
            "language": language,
            "comparison": {
                "models_used": comparison.get('models_used', []),
                "total_models": comparison.get('total_models', 0),
                "model_results": {
                    k: {
                        'model': v.get('model', k),
                        'issues_count': len(v.get('issues', [])),
                        'latency_ms': v.get('latency_ms'),
                        'error': v.get('error'),
                    }
                    for k, v in comparison.get('model_results', {}).items()
                },
                "consensus": {
                    "overall_agreement": comparison.get('consensus', {}).get('overall_agreement', 100),
                    "confidence_level": comparison.get('consensus', {}).get('confidence_level', 'N/A'),
                },
            },
            "fix_first": get_fix_first_top_n(enriched_issues, 3),
            "risk_matrix": get_risk_matrix_summary(enriched_issues),
        }

        # Save to database
        scan_id = save_scan_to_database(result, 'multi_model', f'{language} ({scan_mode})', scan_duration, current_user.id)
        if scan_id:
            result["scan_id"] = scan_id

        return jsonify(result)

    except Exception as e:
        logger.error(f'Multi-model scan error: {str(e)}', exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


# --- 4.2: Smart Issue Prioritization ---

@app.route('/api/issues/prioritize', methods=['POST'])
@token_required
def prioritize_scan_issues(current_user):
    """
    Prioritize issues from a scan with risk scores, effort estimates, and business impact.
    Accepts { issues: [...] } or { scan_id: N }.
    """
    try:
        data = request.get_json()

        issues = data.get('issues', [])

        # If scan_id is provided, fetch issues from database
        if not issues and data.get('scan_id'):
            scan = ScanHistory.query.get(data['scan_id'])
            if not scan:
                return jsonify({"error": "Scan not found"}), 404
            if scan.user_id != current_user.id and not current_user.is_admin:
                return jsonify({"error": "Access denied"}), 403

            db_issues = ScanIssue.query.filter_by(scan_id=scan.id).all()
            issues = [i.to_dict() for i in db_issues]

        if not issues:
            return jsonify({"error": "No issues provided. Send 'issues' array or 'scan_id'."}), 400

        # Enrich with priority data
        enriched = prioritize_issues(issues)
        enriched = feedback_processor.enrich_issues_with_feedback(enriched)

        # Get top recommendations
        fix_first = get_fix_first_top_n(issues, 3)

        # Get risk matrix summary
        risk_matrix = get_risk_matrix_summary(issues)

        return jsonify({
            "issues": enriched,
            "fix_first": fix_first,
            "risk_matrix": risk_matrix,
            "total_issues": len(enriched),
        })

    except Exception as e:
        logger.error(f'Prioritize error: {str(e)}', exc_info=True)
        return jsonify({"error": str(e)}), 500


# --- 4.3: False Positive Learning ---

@app.route('/api/feedback', methods=['POST'])
@token_required
def submit_issue_feedback(current_user):
    """
    Submit feedback for an issue (false positive, confirmed, needs review).
    Body: { scan_id, issue_index, description, severity, file, reason, feedback_type }
    """
    try:
        data = request.get_json()
        # Accept both 'description' and 'issue_description' field names
        if data and data.get('issue_description') and not data.get('description'):
            data['description'] = data['issue_description']
        if not data or not data.get('description'):
            return jsonify({"error": "Issue description is required"}), 400

        valid_types = ['false_positive', 'confirmed', 'needs_review']
        if data.get('feedback_type') not in valid_types:
            data['feedback_type'] = 'false_positive'

        result = feedback_processor.submit_feedback(current_user.id, data)
        logger.info(f'Feedback submitted by user {current_user.id}: {data.get("feedback_type")} for "{data.get("description", "")[:50]}"')

        return jsonify({
            "message": "Feedback submitted successfully",
            "feedback": result,
        }), 201

    except Exception as e:
        logger.error(f'Feedback submit error: {str(e)}', exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedback/stats', methods=['GET'])
@token_required
def get_feedback_stats(current_user):
    """Get historical false positive statistics for the current user."""
    try:
        stats = feedback_processor.get_historical_stats(user_id=current_user.id)
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f'Feedback stats error: {str(e)}', exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedback/export', methods=['GET'])
@token_required
def export_feedback_data(current_user):
    """Export feedback dataset for the current user."""
    try:
        dataset = feedback_processor.export_feedback_dataset(user_id=current_user.id)
        return jsonify({"feedback": dataset, "total": len(dataset)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/feedback/stats', methods=['GET'])
@admin_required
def admin_feedback_stats(current_user):
    """Get global feedback statistics (admin only)."""
    try:
        stats = feedback_processor.get_historical_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/feedback/export', methods=['GET'])
@admin_required
def admin_export_feedback(current_user):
    """Export all feedback data (admin only)."""
    try:
        dataset = feedback_processor.export_feedback_dataset()
        return jsonify({"feedback": dataset, "total": len(dataset)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# DAY 5 ENDPOINTS: Code Fixes & Snippet Library
# =============================================

@app.route('/api/fix/generate', methods=['POST'])
@limiter.limit("10 per minute")
@token_required
def generate_fix(current_user):
    """Generate an AI-powered fix for a specific vulnerability."""
    if not model:
        return jsonify({"error": "AI model not available"}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        code = data.get('code', '')
        issue = data.get('issue', {})
        file_path = sanitize_string(data.get('file_path', 'file'), max_length=500)

        if not issue.get('description'):
            return jsonify({"error": "Issue description is required"}), 400

        # If no source code provided, try to find it in the database
        if not code:
            try:
                db_issue = ScanIssue.query.filter_by(
                    file_path=file_path,
                    description=issue.get('description', '')
                ).order_by(ScanIssue.id.desc()).first()
                if db_issue and db_issue.code_snippet:
                    code = db_issue.code_snippet
            except Exception as db_err:
                logger.warning(f"Could not retrieve code snippet from DB for single fix: {db_err}")

        if not code:
            code = f"# File: {file_path}\n# Vulnerability: {issue.get('description', '')}\n# Severity: {issue.get('severity', 'Unknown')}\n# Suggestion: {issue.get('suggestion', '')}\n\n# (Original source code not available â€” generate fix based on vulnerability description)"

        logger.info(f'Fix generation requested by user {current_user.id}: {issue.get("severity", "?")} - {file_path}')

        result = fix_generator.generate_fix(code, issue, file_path)

        if result.get('error'):
            return jsonify({"error": result['error']}), 500

        return jsonify(result), 200
    except Exception as e:
        logger.error(f'Fix generation error: {traceback.format_exc()}')
        return jsonify({"error": f"Fix generation failed: {str(e)}"}), 500


@app.route('/api/fix/multiple', methods=['POST'])
@limiter.limit("5 per minute")
@token_required
def generate_multiple_fixes(current_user):
    """Generate multiple alternative fixes for a vulnerability."""
    if not model:
        return jsonify({"error": "AI model not available"}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        code = data.get('code', '')
        issue = data.get('issue', {})
        file_path = sanitize_string(data.get('file_path', 'file'), max_length=500)

        if not issue.get('description'):
            return jsonify({"error": "Issue description is required"}), 400

        # If no source code provided, try to find it in the database
        if not code:
            try:
                db_issue = ScanIssue.query.filter_by(
                    file_path=file_path,
                    description=issue.get('description', '')
                ).order_by(ScanIssue.id.desc()).first()
                if db_issue and db_issue.code_snippet:
                    code = db_issue.code_snippet
            except Exception as db_err:
                logger.warning(f"Could not retrieve code snippet from DB for multi-fix: {db_err}")

        if not code:
            code = f"# File: {file_path}\n# Vulnerability: {issue.get('description', '')}\n# Severity: {issue.get('severity', 'Unknown')}\n# Suggestion: {issue.get('suggestion', '')}\n\n# (Original source code not available â€” generate fix based on vulnerability description)"

        logger.info(f'Multi-fix generation requested by user {current_user.id}: {file_path}')

        result = fix_generator.generate_multiple_fixes(code, issue, file_path)

        if result.get('error') and not result.get('fixes'):
            return jsonify({"error": result['error']}), 500

        return jsonify(result), 200
    except Exception as e:
        logger.error(f'Multi-fix generation error: {traceback.format_exc()}')
        return jsonify({"error": f"Multi-fix generation failed: {str(e)}"}), 500


@app.route('/api/fix/download', methods=['POST'])
@limiter.limit("20 per minute")
@token_required
def download_patched_file(current_user):
    """Download a patched file with the fix applied."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        fixed_code = data.get('fixed_code', '')
        file_path = sanitize_string(data.get('file_path', 'patched_file'), max_length=500)

        if not fixed_code:
            return jsonify({"error": "Fixed code is required"}), 400

        # Return the fixed code as a downloadable file
        filename = os.path.basename(file_path) if file_path else 'patched_file'
        return Response(
            fixed_code,
            mimetype='text/plain',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'text/plain; charset=utf-8'
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/fix/stats', methods=['GET'])
@token_required
def fix_stats(current_user):
    """Get fix generation statistics."""
    try:
        stats = fix_generator.get_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/snippets', methods=['GET'])
@token_required
def get_snippets(current_user):
    """Get secure code snippets library with optional filtering."""
    try:
        category = request.args.get('category', '')
        language = request.args.get('language', '')
        search = request.args.get('search', '').lower()
        vulnerability = request.args.get('vulnerability', '').lower()

        patterns = secure_patterns_data.get('patterns', [])
        categories = secure_patterns_data.get('categories', [])

        # Apply filters
        filtered = patterns
        if category:
            filtered = [p for p in filtered if p.get('category') == category]
        if language:
            filtered = [p for p in filtered if p.get('language', '').lower() == language.lower()]
        if vulnerability:
            filtered = [p for p in filtered if vulnerability in p.get('vulnerability', '').lower()]
        if search:
            filtered = [p for p in filtered if (
                search in p.get('title', '').lower() or
                search in p.get('description', '').lower() or
                search in p.get('vulnerability', '').lower() or
                search in p.get('language', '').lower()
            )]

        # Get unique languages and vulnerabilities for filter options
        all_languages = sorted(set(p.get('language', '') for p in patterns))
        all_vulnerabilities = sorted(set(p.get('vulnerability', '') for p in patterns))

        return jsonify({
            "patterns": filtered,
            "categories": categories,
            "total": len(filtered),
            "total_all": len(patterns),
            "filters": {
                "languages": all_languages,
                "vulnerabilities": all_vulnerabilities,
            }
        }), 200
    except Exception as e:
        logger.error(f'Snippet library error: {traceback.format_exc()}')
        return jsonify({"error": str(e)}), 500


@app.route('/api/snippets/<pattern_id>', methods=['GET'])
@token_required
def get_snippet_by_id(current_user, pattern_id):
    """Get a single snippet pattern by ID."""
    try:
        patterns = secure_patterns_data.get('patterns', [])
        for p in patterns:
            if p.get('id') == pattern_id:
                return jsonify(p), 200
        return jsonify({"error": "Pattern not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# â”€â”€ AI CODE EXPLANATION â”€â”€
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CODE_EXPLAIN_PROMPT = """You are a friendly coding mentor. Analyze the following code and explain it clearly.

Break your explanation into sections. For EACH function, class, loop, or important logic block, provide:
1. **Name** (function/class/block name or description)
2. **Purpose** â€“ What does it do, in one sentence?
3. **How it works** â€“ Step-by-step explanation in simple words a beginner can understand.
4. **Key concepts** â€“ Any important programming concepts used (e.g. recursion, list comprehension, error handling).

Return your response as a JSON object with this exact structure:
{{
  "summary": "A 2-3 sentence high-level summary of what the entire code does.",
  "language": "detected programming language",
  "blocks": [
    {{
      "name": "function/class/block name",
      "type": "function | class | loop | conditional | import | config | other",
      "line_range": "lines X-Y (approximate)",
      "purpose": "one-sentence purpose",
      "explanation": "detailed beginner-friendly explanation (2-5 sentences)",
      "concepts": ["concept1", "concept2"]
    }}
  ],
  "tips": ["Optional helpful tip or best practice suggestion"]
}}

Do not include any text outside the JSON object.

Code ({language}):
---
{code}
---
"""

@app.route('/api/explain', methods=['POST'])
@limiter.limit("15 per minute")
@token_required
def explain_code(current_user):
    """AI-powered code explanation endpoint."""
    if not model:
        return jsonify({"error": "Gemini API is not configured."}), 500

    try:
        data = request.get_json()
        if not data or not data.get('code'):
            return jsonify({"error": "Code content is required"}), 400

        code = sanitize_string(data['code'], max_length=100000)
        language = sanitize_string(data.get('language', 'auto-detect'), max_length=50)

        if not code.strip():
            return jsonify({"error": "Code content cannot be empty"}), 400

        prompt = CODE_EXPLAIN_PROMPT.format(language=language, code=code)
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Only strip the OUTER ```json wrapper, preserve inner markdown code blocks
        cleaned = re.sub(r'^```(?:json)?\s*\n?', '', raw)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned.strip())
        result = json.loads(cleaned)

        return jsonify(result), 200

    except json.JSONDecodeError:
        # If JSON parsing fails, return raw text as summary
        return jsonify({
            "summary": response.text.strip() if 'response' in dir() else "Could not parse response.",
            "language": language,
            "blocks": [],
            "tips": []
        }), 200
    except Exception as e:
        logger.error(f'Code explain error: {e}')
        return jsonify({"error": f"Failed to explain code: {str(e)}"}), 500


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# â”€â”€ CHAT WITH YOUR CODE â”€â”€
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CODE_CHAT_PROMPT = """You are an expert coding assistant. The user has shared the following code and is asking a question about it.

Your job:
- Answer the question based ONLY on the provided code.
- Be clear, concise, and helpful.
- If the question asks about a bug, point to the exact line/logic and explain the fix.
- If the question asks about performance, explain what is slow and suggest improvements with code examples.
- If the question is general, give a thoughtful answer referencing specific parts of the code.
- Use markdown formatting in your answer for readability (bold, code blocks, bullet points).

Return your response as a JSON object:
{{
  "answer": "Your detailed answer in markdown format",
  "references": [
    {{
      "line_hint": "approximate line or function name referenced",
      "detail": "short note about what this reference is about"
    }}
  ],
  "follow_up_questions": ["suggested follow-up question 1", "suggested follow-up question 2"]
}}

Do not include any text outside the JSON object.

Code ({language}):
---
{code}
---

Chat History:
{history}

User's Question: {question}
"""

@app.route('/api/chat', methods=['POST'])
@limiter.limit("20 per minute")
@token_required
def chat_with_code(current_user):
    """Chat with your code - ask questions and get AI answers."""
    if not model:
        return jsonify({"error": "Gemini API is not configured."}), 500

    try:
        data = request.get_json()
        if not data or not data.get('code') or not data.get('question'):
            return jsonify({"error": "Both 'code' and 'question' are required"}), 400

        code = sanitize_string(data['code'], max_length=100000)
        question = sanitize_string(data['question'], max_length=2000)
        language = sanitize_string(data.get('language', 'auto-detect'), max_length=50)
        history_list = data.get('history', [])

        if not code.strip():
            return jsonify({"error": "Code content cannot be empty"}), 400
        if not question.strip():
            return jsonify({"error": "Question cannot be empty"}), 400

        # Format chat history
        history_text = ""
        if history_list:
            for msg in history_list[-10:]:  # Keep last 10 messages for context
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                history_text += f"{role.upper()}: {content}\n"
        if not history_text:
            history_text = "(No previous messages)"

        prompt = CODE_CHAT_PROMPT.format(
            language=language, code=code,
            history=history_text, question=question
        )
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        # Only strip the OUTER ```json wrapper, preserve inner markdown code blocks
        cleaned = re.sub(r'^```(?:json)?\s*\n?', '', raw_text)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned.strip())
        result = json.loads(cleaned)

        return jsonify(result), 200

    except json.JSONDecodeError:
        # Fallback: return raw text if JSON parsing fails
        raw = raw_text if 'raw_text' in dir() else "Could not parse response."
        return jsonify({
            "answer": raw,
            "references": [],
            "follow_up_questions": []
        }), 200
    except Exception as e:
        logger.error(f'Code chat error: {e}')
        return jsonify({"error": f"Failed to process question: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
