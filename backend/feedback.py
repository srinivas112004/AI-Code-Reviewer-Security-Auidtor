"""
Day 4.3: False Positive Learning
Handles user feedback on issues, stores false positive data,
and adjusts confidence scores based on historical feedback.
"""

from datetime import datetime
from collections import defaultdict


def create_feedback_model(db):
    """Create the FalsePositive feedback database model."""

    class FalsePositive(db.Model):
        __tablename__ = 'false_positives'
        __table_args__ = (
            db.Index('idx_fp_user', 'user_id'),
            db.Index('idx_fp_scan', 'scan_id'),
            db.Index('idx_fp_pattern', 'issue_pattern_hash'),
            db.Index('idx_fp_created', 'created_at'),
        )

        id = db.Column(db.Integer, primary_key=True)
        scan_id = db.Column(db.Integer, nullable=True)  # References scan_history.id
        issue_index = db.Column(db.Integer, nullable=True)  # Index of issue in scan results
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        issue_description = db.Column(db.Text, nullable=False)
        issue_severity = db.Column(db.String(20), nullable=False)
        issue_file = db.Column(db.String(500), nullable=True)
        reason = db.Column(db.Text, nullable=True)  # User's reason for marking FP
        feedback_type = db.Column(db.String(20), default='false_positive')  # false_positive | confirmed | needs_review
        issue_pattern_hash = db.Column(db.String(64), nullable=True)  # Hash for pattern matching
        created_at = db.Column(db.DateTime, default=datetime.utcnow)

        def to_dict(self):
            return {
                'id': self.id,
                'scan_id': self.scan_id,
                'issue_index': self.issue_index,
                'user_id': self.user_id,
                'issue_description': self.issue_description,
                'issue_severity': self.issue_severity,
                'issue_file': self.issue_file,
                'reason': self.reason,
                'feedback_type': self.feedback_type,
                'created_at': self.created_at.isoformat() if self.created_at else None,
            }

    return FalsePositive


def compute_issue_pattern_hash(description, severity):
    """
    Compute a hash for an issue pattern to match similar issues across scans.
    Uses normalized description + severity for grouping.
    """
    import hashlib
    # Normalize: lowercase, strip extra whitespace, remove line numbers
    import re
    normalized = description.lower().strip()
    normalized = re.sub(r'line\s+\d+', 'line N', normalized)
    normalized = re.sub(r'\s+', ' ', normalized)
    pattern = f"{severity.lower()}:{normalized}"
    return hashlib.sha256(pattern.encode()).hexdigest()[:16]


class FeedbackProcessor:
    """Processes user feedback to adjust issue confidence scores."""

    def __init__(self, db, FalsePositive):
        self.db = db
        self.FalsePositive = FalsePositive
        self._pattern_cache = {}  # Cache pattern stats

    def submit_feedback(self, user_id, feedback_data):
        """
        Submit feedback for an issue.
        feedback_data: {
            scan_id, issue_index, description, severity, file, reason, feedback_type
        }
        """
        pattern_hash = compute_issue_pattern_hash(
            feedback_data.get('description', ''),
            feedback_data.get('severity', 'Low')
        )

        fp = self.FalsePositive(
            scan_id=feedback_data.get('scan_id'),
            issue_index=feedback_data.get('issue_index'),
            user_id=user_id,
            issue_description=feedback_data.get('description', ''),
            issue_severity=feedback_data.get('severity', 'Low'),
            issue_file=feedback_data.get('file', ''),
            reason=feedback_data.get('reason', ''),
            feedback_type=feedback_data.get('feedback_type', 'false_positive'),
            issue_pattern_hash=pattern_hash,
        )

        self.db.session.add(fp)
        self.db.session.commit()

        # Invalidate cache for this pattern
        self._pattern_cache.pop(pattern_hash, None)

        return fp.to_dict()

    def get_pattern_stats(self, description, severity):
        """
        Get feedback statistics for an issue pattern.
        Returns count of false_positive/confirmed/needs_review feedback.
        """
        pattern_hash = compute_issue_pattern_hash(description, severity)

        if pattern_hash in self._pattern_cache:
            return self._pattern_cache[pattern_hash]

        feedbacks = self.FalsePositive.query.filter_by(
            issue_pattern_hash=pattern_hash
        ).all()

        stats = {
            'pattern_hash': pattern_hash,
            'total_feedback': len(feedbacks),
            'false_positive_count': sum(1 for f in feedbacks if f.feedback_type == 'false_positive'),
            'confirmed_count': sum(1 for f in feedbacks if f.feedback_type == 'confirmed'),
            'needs_review_count': sum(1 for f in feedbacks if f.feedback_type == 'needs_review'),
        }

        if stats['total_feedback'] > 0:
            stats['false_positive_rate'] = round(
                stats['false_positive_count'] / stats['total_feedback'] * 100, 1
            )
        else:
            stats['false_positive_rate'] = 0

        self._pattern_cache[pattern_hash] = stats
        return stats

    def adjust_confidence(self, issue, base_confidence=85):
        """
        Adjust issue confidence based on historical feedback.
        High false positive rate → lower confidence.
        High confirmed rate → higher confidence.
        """
        desc = issue.get('description', '')
        severity = issue.get('severity', 'Low')

        stats = self.get_pattern_stats(desc, severity)

        if stats['total_feedback'] == 0:
            return base_confidence  # No feedback, use base

        fp_rate = stats['false_positive_rate']

        # Adjust confidence based on false positive rate
        # Every 10% FP rate reduces confidence by ~8 points
        adjustment = -int(fp_rate * 0.8)

        # Confirmed feedback increases confidence
        if stats['confirmed_count'] > stats['false_positive_count']:
            adjustment += min(10, stats['confirmed_count'] * 3)

        adjusted = max(5, min(100, base_confidence + adjustment))
        return adjusted

    def enrich_issues_with_feedback(self, issues, base_confidence=85):
        """
        Enrich a list of issues with confidence scores adjusted by feedback.
        """
        enriched = []
        for issue in issues:
            confidence = self.adjust_confidence(issue, base_confidence)
            stats = self.get_pattern_stats(
                issue.get('description', ''),
                issue.get('severity', 'Low')
            )
            enriched.append({
                **issue,
                'confidence': confidence,
                'feedback_stats': stats,
            })
        return enriched

    def get_historical_stats(self, user_id=None, limit=50):
        """Get historical false positive statistics."""
        query = self.FalsePositive.query

        if user_id:
            query = query.filter_by(user_id=user_id)

        feedbacks = query.order_by(self.FalsePositive.created_at.desc()).limit(limit).all()

        total = len(feedbacks)
        fp_count = sum(1 for f in feedbacks if f.feedback_type == 'false_positive')
        confirmed_count = sum(1 for f in feedbacks if f.feedback_type == 'confirmed')

        # Group by severity
        by_severity = defaultdict(lambda: {'total': 0, 'false_positive': 0, 'confirmed': 0})
        for f in feedbacks:
            sev = f.issue_severity
            by_severity[sev]['total'] += 1
            by_severity[sev][f.feedback_type] = by_severity[sev].get(f.feedback_type, 0) + 1

        return {
            'total_feedback': total,
            'false_positive_count': fp_count,
            'confirmed_count': confirmed_count,
            'false_positive_rate': round(fp_count / max(total, 1) * 100, 1),
            'by_severity': dict(by_severity),
            'recent_feedback': [f.to_dict() for f in feedbacks[:10]],
        }

    def export_feedback_dataset(self, user_id=None):
        """Export all feedback data for analysis/training."""
        query = self.FalsePositive.query
        if user_id:
            query = query.filter_by(user_id=user_id)

        feedbacks = query.order_by(self.FalsePositive.created_at.desc()).all()
        return [f.to_dict() for f in feedbacks]
