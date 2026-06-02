"""
Day 4.1: Multi-Model AI Comparison
Manages multiple AI model providers (Gemini + OpenAI) for consensus-based scanning.
"""

import os
import json
import time
import hashlib
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed


class AIModelProvider:
    """Base class for AI model providers."""

    def __init__(self, name, model_id, cost_per_1k_tokens=0.0):
        self.name = name
        self.model_id = model_id
        self.cost_per_1k_tokens = cost_per_1k_tokens
        self.available = False
        self.total_calls = 0
        self.total_tokens = 0
        self.avg_latency_ms = 0
        self._latencies = []

    def analyze(self, prompt):
        """Analyze code with this model. Returns dict with 'issues' key."""
        raise NotImplementedError

    def _record_latency(self, latency_ms):
        self._latencies.append(latency_ms)
        if len(self._latencies) > 100:
            self._latencies = self._latencies[-100:]
        self.avg_latency_ms = sum(self._latencies) / len(self._latencies)

    def get_info(self):
        return {
            'name': self.name,
            'model_id': self.model_id,
            'available': self.available,
            'cost_per_1k_tokens': self.cost_per_1k_tokens,
            'total_calls': self.total_calls,
            'avg_latency_ms': round(self.avg_latency_ms, 1),
        }


class GeminiProvider(AIModelProvider):
    """Google Gemini AI provider."""

    def __init__(self, model=None):
        super().__init__('Google Gemini', 'gemini-2.5-flash', cost_per_1k_tokens=0.0)
        self.model = model
        self.available = model is not None
        if model and hasattr(model, '_model_name'):
            self.model_id = model._model_name

    def analyze(self, prompt):
        if not self.available or not self.model:
            return None
        start = time.time()
        try:
            response = self.model.generate_content(prompt)
            latency = (time.time() - start) * 1000
            self._record_latency(latency)
            self.total_calls += 1

            cleaned = response.text.strip().replace("```json", "").replace("```", "")
            data = json.loads(cleaned)
            return {
                'issues': data.get('issues', []),
                'model': self.name,
                'model_id': self.model_id,
                'latency_ms': round(latency, 1),
            }
        except Exception as e:
            return {
                'issues': [],
                'model': self.name,
                'model_id': self.model_id,
                'error': str(e),
            }


class OpenAIProvider(AIModelProvider):
    """OpenAI GPT provider (optional)."""

    def __init__(self):
        super().__init__('OpenAI GPT-4', 'gpt-4', cost_per_1k_tokens=0.03)
        self.client = None
        self._init_client()

    def _init_client(self):
        try:
            api_key = os.environ.get('OPENAI_API_KEY')
            if api_key:
                import openai
                self.client = openai.OpenAI(api_key=api_key)
                self.available = True
                # Check if gpt-4o-mini is available (cheaper), fallback to gpt-4
                self.model_id = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
                self.cost_per_1k_tokens = 0.00015 if 'mini' in self.model_id else 0.03
        except ImportError:
            self.available = False
        except Exception:
            self.available = False

    def analyze(self, prompt):
        if not self.available or not self.client:
            return None
        start = time.time()
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a security code auditor. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=4096,
            )
            latency = (time.time() - start) * 1000
            self._record_latency(latency)
            self.total_calls += 1

            text = response.choices[0].message.content.strip()
            cleaned = text.replace("```json", "").replace("```", "")
            data = json.loads(cleaned)
            return {
                'issues': data.get('issues', []),
                'model': self.name,
                'model_id': self.model_id,
                'latency_ms': round(latency, 1),
            }
        except Exception as e:
            return {
                'issues': [],
                'model': self.name,
                'model_id': self.model_id,
                'error': str(e),
            }


class MultiModelManager:
    """Manages multiple AI providers and implements consensus scoring."""

    def __init__(self, gemini_model=None):
        self.providers = {}
        self._setup_providers(gemini_model)

    def _setup_providers(self, gemini_model):
        # Always add Gemini (primary)
        gemini = GeminiProvider(gemini_model)
        self.providers['gemini'] = gemini

        # Try to add OpenAI (optional)
        openai_provider = OpenAIProvider()
        self.providers['openai'] = openai_provider

    def get_available_models(self):
        """Return list of available models."""
        return [p.get_info() for p in self.providers.values()]

    def get_active_models(self):
        """Return only available providers."""
        return {k: v for k, v in self.providers.items() if v.available}

    def analyze_single(self, prompt, model_key='gemini'):
        """Run analysis with a single model."""
        provider = self.providers.get(model_key)
        if not provider or not provider.available:
            return None
        return provider.analyze(prompt)

    def analyze_multi(self, prompt, model_keys=None):
        """
        Run analysis with multiple models in parallel.
        Returns individual results + consensus analysis.
        """
        active = self.get_active_models()
        if model_keys:
            active = {k: v for k, v in active.items() if k in model_keys}

        if not active:
            return {'error': 'No AI models available', 'results': []}

        results = {}
        # Run models in parallel using threads
        with ThreadPoolExecutor(max_workers=len(active)) as executor:
            future_to_key = {
                executor.submit(provider.analyze, prompt): key
                for key, provider in active.items()
            }
            for future in as_completed(future_to_key):
                key = future_to_key[future]
                try:
                    result = future.result()
                    if result:
                        results[key] = result
                except Exception as e:
                    results[key] = {
                        'issues': [],
                        'model': active[key].name,
                        'error': str(e),
                    }

        # Build consensus
        consensus = self._build_consensus(results)
        return {
            'model_results': results,
            'consensus': consensus,
            'models_used': list(results.keys()),
            'total_models': len(results),
        }

    def _build_consensus(self, results):
        """
        Build consensus from multiple model results.
        Uses description similarity to match issues across models.
        """
        if len(results) <= 1:
            # Only one model - return its results as-is with 100% confidence
            for key, result in results.items():
                issues = result.get('issues', [])
                for issue in issues:
                    issue['confidence'] = 100
                    issue['agreed_by'] = [result.get('model', key)]
                    issue['agreement_pct'] = 100
                return {
                    'issues': issues,
                    'overall_agreement': 100,
                    'confidence_level': 'High (single model)',
                    'models_agreed': 1,
                    'total_models': 1,
                }

        # Collect all issues from all models
        all_model_issues = {}
        for key, result in results.items():
            model_name = result.get('model', key)
            for issue in result.get('issues', []):
                issue['_source_model'] = model_name
            all_model_issues[key] = result.get('issues', [])

        # Match issues across models by description similarity
        consensus_issues = []
        matched_indices = {k: set() for k in all_model_issues}

        # Use first model's issues as base, then match others
        model_keys = list(all_model_issues.keys())
        base_key = model_keys[0]
        base_issues = all_model_issues[base_key]

        for i, base_issue in enumerate(base_issues):
            agreed_by = [results[base_key].get('model', base_key)]
            matched_indices[base_key].add(i)

            for other_key in model_keys[1:]:
                other_issues = all_model_issues[other_key]
                best_match_idx = self._find_best_match(base_issue, other_issues, matched_indices[other_key])
                if best_match_idx is not None:
                    matched_indices[other_key].add(best_match_idx)
                    agreed_by.append(results[other_key].get('model', other_key))

            agreement_pct = round(len(agreed_by) / len(results) * 100)
            confidence = self._calculate_confidence(agreement_pct, base_issue.get('severity', 'Low'))

            consensus_issue = {
                'severity': base_issue.get('severity', 'Low'),
                'description': base_issue.get('description', ''),
                'suggestion': base_issue.get('suggestion', ''),
                'file': base_issue.get('file', ''),
                'line_number': base_issue.get('line_number'),
                'confidence': confidence,
                'agreed_by': agreed_by,
                'agreement_pct': agreement_pct,
            }
            consensus_issues.append(consensus_issue)

        # Add unmatched issues from other models with lower confidence
        for other_key in model_keys[1:]:
            other_issues = all_model_issues[other_key]
            for j, issue in enumerate(other_issues):
                if j not in matched_indices.get(other_key, set()):
                    consensus_issues.append({
                        'severity': issue.get('severity', 'Low'),
                        'description': issue.get('description', ''),
                        'suggestion': issue.get('suggestion', ''),
                        'file': issue.get('file', ''),
                        'line_number': issue.get('line_number'),
                        'confidence': 40,  # Low confidence - only found by one model
                        'agreed_by': [results[other_key].get('model', other_key)],
                        'agreement_pct': round(1 / len(results) * 100),
                    })

        # Calculate overall agreement
        if consensus_issues:
            avg_agreement = sum(i['agreement_pct'] for i in consensus_issues) / len(consensus_issues)
        else:
            avg_agreement = 100

        if avg_agreement >= 80:
            confidence_level = 'High'
        elif avg_agreement >= 50:
            confidence_level = 'Medium'
        else:
            confidence_level = 'Low - Manual review recommended'

        return {
            'issues': consensus_issues,
            'overall_agreement': round(avg_agreement),
            'confidence_level': confidence_level,
            'models_agreed': len(results),
            'total_models': len(results),
        }

    def _find_best_match(self, issue, candidates, already_matched):
        """Find the best matching issue from candidates using text similarity."""
        desc = (issue.get('description', '') or '').lower()
        severity = (issue.get('severity', '') or '').lower()

        best_score = 0
        best_idx = None

        for idx, candidate in enumerate(candidates):
            if idx in already_matched:
                continue

            c_desc = (candidate.get('description', '') or '').lower()
            c_sev = (candidate.get('severity', '') or '').lower()

            # Simple word overlap similarity
            words_a = set(desc.split())
            words_b = set(c_desc.split())

            if not words_a or not words_b:
                continue

            overlap = len(words_a & words_b)
            total = len(words_a | words_b)
            similarity = overlap / total if total > 0 else 0

            # Boost score if severity matches
            if severity == c_sev:
                similarity += 0.2

            if similarity > best_score and similarity >= 0.3:
                best_score = similarity
                best_idx = idx

        return best_idx

    def _calculate_confidence(self, agreement_pct, severity):
        """Calculate confidence score (0-100) based on agreement and severity."""
        base = agreement_pct

        # Higher severity issues need higher agreement for same confidence
        severity_modifier = {
            'Critical': -5,
            'High': -3,
            'Medium': 0,
            'Low': 5,
        }
        modifier = severity_modifier.get(severity, 0)
        return max(0, min(100, base + modifier))

    def get_cost_comparison(self):
        """Get cost comparison between models."""
        comparison = []
        for key, provider in self.providers.items():
            comparison.append({
                'model': provider.name,
                'model_id': provider.model_id,
                'available': provider.available,
                'cost_per_1k_tokens': provider.cost_per_1k_tokens,
                'total_calls': provider.total_calls,
                'avg_latency_ms': round(provider.avg_latency_ms, 1),
                'estimated_cost_per_scan': round(provider.cost_per_1k_tokens * 2, 4),  # ~2K tokens per file
            })
        return comparison
