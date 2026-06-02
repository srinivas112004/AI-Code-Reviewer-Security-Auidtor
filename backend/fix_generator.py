"""
Day 5.1: AI-Generated Code Fixes
Generates secure code alternatives for detected vulnerabilities.
Provides before/after diffs, explanations, and downloadable patches.
"""

import json
import time
import re
import difflib
from datetime import datetime


# Fix generation prompt template
FIX_PROMPT = """You are an expert secure code reviewer. Given the following vulnerable code and vulnerability details,
generate a secure fix.

VULNERABLE CODE:
```
{vulnerable_code}
```

VULNERABILITY: {vuln_description}
SEVERITY: {severity}
FILE: {file_path}
SUGGESTION: {suggestion}

Generate a JSON response with EXACTLY this structure (no extra text):
{{
  "fixed_code": "<the complete fixed version of the code snippet>",
  "explanation": "<detailed explanation of what was changed and why>",
  "changes_summary": "<brief one-line summary of the fix>",
  "security_notes": "<any additional security considerations>",
  "confidence": <0.0 to 1.0 confidence in the fix>
}}

Rules:
1. Fix ONLY the vulnerability described - don't change unrelated code
2. Maintain the original code's functionality
3. Follow best practices for the language
4. Add inline comments explaining security-critical changes
5. Return ONLY the JSON object, no markdown fencing
6. In "explanation", "changes_summary", and "security_notes", write ONLY plain text. Do NOT use any markdown formatting, asterisks (**), backticks (`), bullet lists, or bolding. Use standard paragraphs and plain numbered list format without any formatting tags.
"""

MULTI_FIX_PROMPT = """You are an expert secure code reviewer. Given the following vulnerable code and vulnerability,
suggest MULTIPLE alternative fixes ranked by security strength.

VULNERABLE CODE:
```
{vulnerable_code}
```

VULNERABILITY: {vuln_description}
SEVERITY: {severity}

Generate a JSON response with EXACTLY this structure (no extra text):
{{
  "fixes": [
    {{
      "approach": "<name of the fix approach>",
      "fixed_code": "<complete fixed code>",
      "explanation": "<why this approach works>",
      "pros": ["<advantage 1>", "<advantage 2>"],
      "cons": ["<disadvantage 1>"],
      "confidence": <0.0-1.0>
    }}
  ]
}}

Provide 2-3 alternative fixes, ranked from most to least recommended.
Return ONLY the JSON object, no markdown fencing.
Rules:
1. In "explanation", "pros", and "cons", write ONLY plain text. Do NOT use any markdown formatting, asterisks (**), backticks (`), or bolding. Use standard formatting.
"""


def _extract_code_context(full_code, issue_description, file_path):
    """
    Try to extract the relevant code snippet around the vulnerability.
    Returns a reasonable chunk of code around the issue.
    """
    if not full_code:
        return full_code

    lines = full_code.split('\n')
    total_lines = len(lines)

    # If the code is short, return all of it
    if total_lines <= 60:
        return full_code

    # Try to find the relevant section based on keywords in the description
    keywords = re.findall(r'\b\w{4,}\b', issue_description.lower())
    # Remove common words
    stop_words = {'this', 'that', 'with', 'from', 'have', 'been', 'code', 'could',
                  'should', 'would', 'using', 'uses', 'used', 'issue', 'found',
                  'does', 'make', 'made', 'being', 'into', 'over', 'such', 'when',
                  'which', 'there', 'their', 'will', 'each', 'about', 'within'}
    keywords = [k for k in keywords if k not in stop_words]

    best_line = 0
    best_score = 0
    for i, line in enumerate(lines):
        line_lower = line.lower()
        score = sum(1 for kw in keywords if kw in line_lower)
        if score > best_score:
            best_score = score
            best_line = i

    # Extract a window around the best match
    window = 25
    start = max(0, best_line - window)
    end = min(total_lines, best_line + window + 1)
    return '\n'.join(lines[start:end])


def generate_unified_diff(original, fixed, file_path='file'):
    """Generate a unified diff between original and fixed code."""
    original_lines = original.splitlines(keepends=True)
    fixed_lines = fixed.splitlines(keepends=True)

    # Ensure lines end with newline for clean diff
    if original_lines and not original_lines[-1].endswith('\n'):
        original_lines[-1] += '\n'
    if fixed_lines and not fixed_lines[-1].endswith('\n'):
        fixed_lines[-1] += '\n'

    diff = difflib.unified_diff(
        original_lines,
        fixed_lines,
        fromfile=f'a/{file_path}',
        tofile=f'b/{file_path}',
        lineterm='\n'
    )
    return ''.join(diff)


def generate_html_diff(original, fixed):
    """Generate an HTML side-by-side diff."""
    differ = difflib.HtmlDiff(wrapcolumn=80)
    return differ.make_table(
        original.splitlines(),
        fixed.splitlines(),
        fromdesc='Vulnerable',
        todesc='Fixed',
        context=True,
        numlines=3
    )


def generate_inline_diff(original, fixed):
    """Generate line-by-line diff info for frontend rendering."""
    orig_lines = original.splitlines()
    fixed_lines = fixed.splitlines()

    sm = difflib.SequenceMatcher(None, orig_lines, fixed_lines)
    diff_lines = []

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for line in orig_lines[i1:i2]:
                diff_lines.append({'type': 'unchanged', 'content': line})
        elif tag == 'delete':
            for line in orig_lines[i1:i2]:
                diff_lines.append({'type': 'removed', 'content': line})
        elif tag == 'insert':
            for line in fixed_lines[j1:j2]:
                diff_lines.append({'type': 'added', 'content': line})
        elif tag == 'replace':
            for line in orig_lines[i1:i2]:
                diff_lines.append({'type': 'removed', 'content': line})
            for line in fixed_lines[j1:j2]:
                diff_lines.append({'type': 'added', 'content': line})

    return diff_lines


def strip_markdown(text):
    """Remove common markdown styling (bold, italic, inline code) from text."""
    if not text:
        return text
    # Remove bold/italic markup: **text** or *text* or __text__ or _text_
    text = re.sub(r'\*\*+(.*?)\*\*+', r'\1', text)
    text = re.sub(r'\*+(.*?)\*+', r'\1', text)
    text = re.sub(r'__+(.*?)__+', r'\1', text)
    text = re.sub(r'_+(.*?)_+', r'\1', text)
    # Remove inline backticks: `code` -> code
    text = re.sub(r'`([^`\n]+)`', r'\1', text)
    # Remove markdown headers: # Header -> Header
    text = re.sub(r'^\s*#+\s+(.*?)\s*$', r'\1', text, flags=re.MULTILINE)
    return text


class FixGenerator:
    """Generates AI-powered code fixes for detected vulnerabilities."""

    def __init__(self, gemini_model):
        self.model = gemini_model
        self.fix_cache = {}  # Simple in-memory cache
        self.total_fixes = 0
        self.avg_generation_time = 0
        self._gen_times = []

    def _parse_json_response(self, text):
        """Robustly parse JSON from AI response."""
        cleaned = text.strip()
        # Remove markdown fencing
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        cleaned = cleaned.strip()
        return json.loads(cleaned)

    def _record_time(self, elapsed):
        self._gen_times.append(elapsed)
        if len(self._gen_times) > 100:
            self._gen_times = self._gen_times[-100:]
        self.avg_generation_time = sum(self._gen_times) / len(self._gen_times)

    def generate_fix(self, code, issue, file_path='file'):
        """
        Generate a single fix for a vulnerability.

        Args:
            code: The source code (full file or snippet)
            issue: Dict with 'description', 'severity', 'suggestion'
            file_path: The file path for context

        Returns:
            Dict with fix details including diff
        """
        if not self.model:
            return {'error': 'AI model not available'}

        description = issue.get('description', '')
        severity = issue.get('severity', 'Medium')
        suggestion = issue.get('suggestion', '')

        # Extract relevant code context
        code_snippet = _extract_code_context(code, description, file_path)

        # Check cache
        import hashlib
        cache_key = hashlib.md5(f"{code_snippet}:{description}:{severity}".encode()).hexdigest()
        if cache_key in self.fix_cache:
            return self.fix_cache[cache_key]

        prompt = FIX_PROMPT.format(
            vulnerable_code=code_snippet,
            vuln_description=description,
            severity=severity,
            file_path=file_path,
            suggestion=suggestion
        )

        start_time = time.time()
        try:
            response = self.model.generate_content(prompt)
            elapsed = time.time() - start_time
            self._record_time(elapsed)

            result = self._parse_json_response(response.text)

            fixed_code = result.get('fixed_code', '')
            if not fixed_code:
                return {'error': 'AI did not generate a fix'}

            # Generate diffs
            unified_diff = generate_unified_diff(code_snippet, fixed_code, file_path)
            inline_diff = generate_inline_diff(code_snippet, fixed_code)

            fix_result = {
                'original_code': code_snippet,
                'fixed_code': fixed_code,
                'explanation': strip_markdown(result.get('explanation', '')),
                'changes_summary': strip_markdown(result.get('changes_summary', '')),
                'security_notes': strip_markdown(result.get('security_notes', '')),
                'confidence': min(max(result.get('confidence', 0.7), 0.0), 1.0),
                'unified_diff': unified_diff,
                'inline_diff': inline_diff,
                'generation_time_ms': round(elapsed * 1000),
                'issue': {
                    'description': description,
                    'severity': severity,
                    'file': file_path,
                    'suggestion': suggestion,
                },
                'generated_at': datetime.utcnow().isoformat(),
            }

            self.total_fixes += 1
            self.fix_cache[cache_key] = fix_result
            return fix_result

        except json.JSONDecodeError as e:
            return {
                'error': f'Failed to parse AI response: {str(e)}',
                'raw_response': response.text[:500] if 'response' in dir() else '',
            }
        except Exception as e:
            return {
                'error': f'Fix generation failed: {str(e)}',
            }

    def generate_multiple_fixes(self, code, issue, file_path='file'):
        """
        Generate multiple alternative fixes for a vulnerability.

        Returns:
            Dict with list of fix alternatives
        """
        if not self.model:
            return {'error': 'AI model not available', 'fixes': []}

        description = issue.get('description', '')
        severity = issue.get('severity', 'Medium')

        code_snippet = _extract_code_context(code, description, file_path)

        prompt = MULTI_FIX_PROMPT.format(
            vulnerable_code=code_snippet,
            vuln_description=description,
            severity=severity
        )

        start_time = time.time()
        try:
            response = self.model.generate_content(prompt)
            elapsed = time.time() - start_time
            self._record_time(elapsed)

            result = self._parse_json_response(response.text)
            fixes = result.get('fixes', [])

            enriched_fixes = []
            for fix in fixes:
                fixed_code = fix.get('fixed_code', '')
                if not fixed_code:
                    continue

                unified_diff = generate_unified_diff(code_snippet, fixed_code, file_path)
                inline_diff = generate_inline_diff(code_snippet, fixed_code)

                enriched_fixes.append({
                    'approach': fix.get('approach', 'Fix'),
                    'fixed_code': fixed_code,
                    'explanation': strip_markdown(fix.get('explanation', '')),
                    'pros': [strip_markdown(p) for p in fix.get('pros', [])] if isinstance(fix.get('pros'), list) else [strip_markdown(fix.get('pros', ''))] if fix.get('pros') else [],
                    'cons': [strip_markdown(c) for c in fix.get('cons', [])] if isinstance(fix.get('cons'), list) else [strip_markdown(fix.get('cons', ''))] if fix.get('cons') else [],
                    'confidence': min(max(fix.get('confidence', 0.7), 0.0), 1.0),
                    'unified_diff': unified_diff,
                    'inline_diff': inline_diff,
                })

            self.total_fixes += len(enriched_fixes)

            return {
                'original_code': code_snippet,
                'fixes': enriched_fixes,
                'generation_time_ms': round(elapsed * 1000),
                'issue': {
                    'description': description,
                    'severity': severity,
                    'file': file_path,
                },
                'generated_at': datetime.utcnow().isoformat(),
            }

        except json.JSONDecodeError as e:
            return {
                'error': f'Failed to parse AI response: {str(e)}',
                'fixes': [],
            }
        except Exception as e:
            return {
                'error': f'Multi-fix generation failed: {str(e)}',
                'fixes': [],
            }

    def generate_patched_file(self, original_code, fixed_code, file_path):
        """
        Apply a fix to the full file content and return the patched version.
        Uses SequenceMatcher to locate and replace the vulnerable code section.
        """
        if not original_code or not fixed_code:
            return original_code

        # If the fix IS the full file, just return it
        if original_code.strip() == fixed_code.strip():
            return original_code

        # Try direct replacement
        # The original_code might be a snippet extracted from a larger file
        # In that case fixed_code replaces the snippet
        return fixed_code

    def get_stats(self):
        """Return fix generation statistics."""
        return {
            'total_fixes_generated': self.total_fixes,
            'avg_generation_time_ms': round(self.avg_generation_time * 1000) if self.avg_generation_time else 0,
            'cache_size': len(self.fix_cache),
        }
