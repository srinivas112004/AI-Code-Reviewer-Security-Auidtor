"""
Day 4.2: Smart Issue Prioritization
Implements CVSS-like scoring, risk calculation, effort estimation, and business impact categorization.
"""

import re
from collections import defaultdict


# --- CVSS-like Scoring Vectors ---

ATTACK_VECTOR = {
    'network': 0.85,
    'adjacent': 0.62,
    'local': 0.55,
    'physical': 0.20,
}

ATTACK_COMPLEXITY = {
    'low': 0.77,
    'high': 0.44,
}

PRIVILEGES_REQUIRED = {
    'none': 0.85,
    'low': 0.62,
    'high': 0.27,
}

USER_INTERACTION = {
    'none': 0.85,
    'required': 0.62,
}

# Keywords that help determine CVSS vectors from issue descriptions
NETWORK_KEYWORDS = [
    'sql injection', 'xss', 'cross-site', 'ssrf', 'server-side request',
    'remote code', 'rce', 'api', 'http', 'url', 'endpoint', 'request',
    'cors', 'csrf', 'cookie', 'session', 'token', 'authentication',
    'injection', 'command injection', 'header injection', 'ldap',
]

LOCAL_KEYWORDS = [
    'file', 'path traversal', 'local file', 'directory traversal',
    'symlink', 'hardcoded', 'environment variable', 'config',
    'permission', 'privilege', 'buffer overflow', 'memory',
]

NO_PRIV_KEYWORDS = [
    'unauthenticated', 'no authentication', 'public', 'anonymous',
    'without login', 'pre-auth',
]

USER_INTERACTION_KEYWORDS = [
    'user clicks', 'social engineering', 'phishing', 'user input',
    'user interaction', 'click', 'visit', 'open',
]

# Business Impact Mapping
BUSINESS_IMPACT = {
    'Critical': {
        'category': 'Critical',
        'description': 'Data breach, financial loss, complete system compromise',
        'color': '#dc3545',
        'action': 'Fix immediately — production risk',
    },
    'High': {
        'category': 'High',
        'description': 'Service disruption, partial data exposure',
        'color': '#fd7e14',
        'action': 'Fix this week — significant risk',
    },
    'Medium': {
        'category': 'Medium',
        'description': 'Performance impact, limited exposure',
        'color': '#ffc107',
        'action': 'Fix this sprint — moderate risk',
    },
    'Low': {
        'category': 'Low',
        'description': 'Best practice violation, minimal impact',
        'color': '#17a2b8',
        'action': 'Schedule later — low priority',
    },
}

# Effort Estimation Patterns
EFFORT_PATTERNS = {
    'low': {  # < 1 hour
        'keywords': [
            'hardcoded', 'secret', 'password', 'credential', 'api key',
            'debug mode', 'verbose', 'logging', 'comment', 'todo',
            'deprecated', 'version', 'update dependency', 'header',
            'content-type', 'encoding',
        ],
        'label': 'Low (~30 min)',
        'hours_estimate': 0.5,
        'color': '#4caf50',
    },
    'medium': {  # 1-4 hours
        'keywords': [
            'input validation', 'sanitiz', 'escap', 'parameterized',
            'prepared statement', 'csrf token', 'rate limit',
            'access control', 'authorization', 'permission check',
            'error handling', 'exception', 'try-catch', 'encryption',
        ],
        'label': 'Medium (~2-4 hrs)',
        'hours_estimate': 3,
        'color': '#ff9800',
    },
    'high': {  # > 4 hours
        'keywords': [
            'architecture', 'redesign', 'refactor', 'authentication system',
            'session management', 'cryptograph', 'encryption scheme',
            'database schema', 'migration', 'api redesign', 'security framework',
        ],
        'label': 'High (~4-8 hrs)',
        'hours_estimate': 6,
        'color': '#f44336',
    },
}


def _text_contains_any(text, keywords):
    """Check if text contains any of the given keywords (case-insensitive)."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in keywords)


def calculate_cvss_vectors(issue):
    """
    Determine CVSS-like vectors from issue description.
    Returns dict with vector values.
    """
    desc = (issue.get('description', '') + ' ' + issue.get('suggestion', '')).lower()

    # Attack Vector
    if _text_contains_any(desc, NETWORK_KEYWORDS):
        av = 'network'
    elif _text_contains_any(desc, LOCAL_KEYWORDS):
        av = 'local'
    else:
        av = 'adjacent'

    # Attack Complexity
    severity = issue.get('severity', 'Low')
    if severity in ('Critical', 'High'):
        ac = 'low'  # Critical/High vulns are typically easy to exploit
    else:
        ac = 'high'

    # Privileges Required
    if _text_contains_any(desc, NO_PRIV_KEYWORDS):
        pr = 'none'
    elif severity == 'Critical':
        pr = 'none'
    elif severity == 'High':
        pr = 'low'
    else:
        pr = 'high'

    # User Interaction
    if _text_contains_any(desc, USER_INTERACTION_KEYWORDS):
        ui = 'required'
    else:
        ui = 'none'

    return {
        'attack_vector': av,
        'attack_complexity': ac,
        'privileges_required': pr,
        'user_interaction': ui,
    }


def calculate_risk_score(issue):
    """
    Calculate risk score (0-10) using CVSS-like formula:
    Risk = Severity × Exploitability × Business Impact
    """
    severity = issue.get('severity', 'Low')

    # Severity base score
    severity_scores = {
        'Critical': 9.5,
        'High': 7.5,
        'Medium': 5.0,
        'Low': 2.5,
    }
    base_severity = severity_scores.get(severity, 2.5)

    # Get CVSS vectors
    vectors = calculate_cvss_vectors(issue)

    # Exploitability score
    av_score = ATTACK_VECTOR.get(vectors['attack_vector'], 0.5)
    ac_score = ATTACK_COMPLEXITY.get(vectors['attack_complexity'], 0.5)
    pr_score = PRIVILEGES_REQUIRED.get(vectors['privileges_required'], 0.5)
    ui_score = USER_INTERACTION.get(vectors['user_interaction'], 0.5)

    exploitability = 8.22 * av_score * ac_score * pr_score * ui_score

    # Normalize: combine base severity with exploitability
    # Scale to 0-10
    risk_score = min(10.0, (base_severity * 0.6) + (exploitability * 0.4) / 8.22 * 10 * 0.4)

    return round(risk_score, 1)


def estimate_effort(issue):
    """
    Estimate fix effort based on issue description patterns.
    Returns effort dict with label, hours, and color.
    """
    desc = (issue.get('description', '') + ' ' + issue.get('suggestion', '')).lower()

    # Check from high to low effort (match most specific first)
    for level in ['high', 'medium', 'low']:
        pattern = EFFORT_PATTERNS[level]
        if _text_contains_any(desc, pattern['keywords']):
            return {
                'level': level,
                'label': pattern['label'],
                'hours_estimate': pattern['hours_estimate'],
                'color': pattern['color'],
            }

    # Default based on severity
    severity = issue.get('severity', 'Low')
    if severity in ('Critical', 'High'):
        return {
            'level': 'medium',
            'label': EFFORT_PATTERNS['medium']['label'],
            'hours_estimate': EFFORT_PATTERNS['medium']['hours_estimate'],
            'color': EFFORT_PATTERNS['medium']['color'],
        }
    return {
        'level': 'low',
        'label': EFFORT_PATTERNS['low']['label'],
        'hours_estimate': EFFORT_PATTERNS['low']['hours_estimate'],
        'color': EFFORT_PATTERNS['low']['color'],
    }


def get_business_impact(issue):
    """Get business impact categorization for an issue."""
    severity = issue.get('severity', 'Low')
    return BUSINESS_IMPACT.get(severity, BUSINESS_IMPACT['Low'])


def get_risk_level(risk_score):
    """Get risk level label and color from risk score."""
    if risk_score >= 9:
        return {'level': 'Critical', 'color': '#dc3545', 'action': 'Fix immediately'}
    elif risk_score >= 7:
        return {'level': 'High', 'color': '#fd7e14', 'action': 'Fix this week'}
    elif risk_score >= 4:
        return {'level': 'Medium', 'color': '#ffc107', 'action': 'Fix this sprint'}
    else:
        return {'level': 'Low', 'color': '#17a2b8', 'action': 'Schedule later'}


def prioritize_issues(issues):
    """
    Enrich and prioritize a list of issues with risk scores, effort estimates,
    and business impact. Returns the list sorted by risk score (descending).
    """
    enriched = []
    for issue in issues:
        risk_score = calculate_risk_score(issue)
        effort = estimate_effort(issue)
        impact = get_business_impact(issue)
        vectors = calculate_cvss_vectors(issue)
        risk_level = get_risk_level(risk_score)

        enriched_issue = {
            **issue,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'effort': effort,
            'business_impact': impact,
            'cvss_vectors': vectors,
            # Preserve existing confidence if present
            'confidence': issue.get('confidence', 85),
        }
        enriched.append(enriched_issue)

    # Sort by risk score descending
    enriched.sort(key=lambda x: x['risk_score'], reverse=True)
    return enriched


def get_fix_first_top_n(issues, n=3):
    """
    Get top N "Fix This First" recommendations.
    Prioritizes by risk score, then by effort (prefer lower effort for same risk).
    """
    prioritized = prioritize_issues(issues)

    # For "fix first", we want high risk + low effort = best ROI
    def priority_key(issue):
        risk = issue.get('risk_score', 0)
        effort_hours = issue.get('effort', {}).get('hours_estimate', 4)
        # Higher risk / lower effort = higher priority
        return risk / max(effort_hours, 0.5)

    prioritized.sort(key=priority_key, reverse=True)
    return prioritized[:n]


def get_risk_matrix_summary(issues):
    """
    Generate a risk matrix summary for the dashboard.
    Returns counts by risk level and effort level.
    """
    prioritized = prioritize_issues(issues)

    matrix = {
        'by_risk_level': defaultdict(int),
        'by_effort': defaultdict(int),
        'risk_effort_matrix': defaultdict(lambda: defaultdict(int)),
        'total_estimated_hours': 0,
        'risk_distribution': [],
    }

    for issue in prioritized:
        risk_level = issue.get('risk_level', {}).get('level', 'Low')
        effort_level = issue.get('effort', {}).get('level', 'low')
        hours = issue.get('effort', {}).get('hours_estimate', 1)

        matrix['by_risk_level'][risk_level] += 1
        matrix['by_effort'][effort_level] += 1
        matrix['risk_effort_matrix'][risk_level][effort_level] += 1
        matrix['total_estimated_hours'] += hours

    # Convert defaultdicts to regular dicts for JSON serialization
    matrix['by_risk_level'] = dict(matrix['by_risk_level'])
    matrix['by_effort'] = dict(matrix['by_effort'])
    matrix['risk_effort_matrix'] = {k: dict(v) for k, v in matrix['risk_effort_matrix'].items()}
    matrix['total_estimated_hours'] = round(matrix['total_estimated_hours'], 1)

    # Risk distribution for charts
    for level in ['Critical', 'High', 'Medium', 'Low']:
        count = matrix['by_risk_level'].get(level, 0)
        matrix['risk_distribution'].append({
            'level': level,
            'count': count,
            'color': get_risk_level(9 if level == 'Critical' else 7 if level == 'High' else 4 if level == 'Medium' else 1)['color'],
        })

    return matrix
