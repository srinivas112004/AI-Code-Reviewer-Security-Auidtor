/**
 * CSV Export Utility
 * Exports scan results as a downloadable CSV file with all issue details.
 */

function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function scanResultToCSV(scanResult) {
  const issues = scanResult.issues || [];
  const lines = [];

  // Header section
  lines.push("AI Code Auditor - Security Scan Report");
  lines.push(`Report Generated,${new Date().toISOString()}`);
  lines.push(`Overall Score,${scanResult.overall_score || 0}`);
  lines.push(`Files Scanned,${scanResult.files_scanned || 0}`);
  lines.push(`Scan Duration,${scanResult.scan_duration || 0}s`);
  lines.push(`Total Issues,${issues.length}`);
  if (scanResult.scan_mode) lines.push(`Scan Mode,${scanResult.scan_mode}`);
  if (scanResult.language) lines.push(`Language,${scanResult.language}`);
  lines.push("");

  // Metrics section
  lines.push("--- Metrics ---");
  lines.push(`Code Complexity,${scanResult.metrics?.code_complexity || "N/A"}`);
  lines.push(`Code Duplication,${scanResult.metrics?.duplication_percentage || 0}%`);
  lines.push(`Vulnerable Dependencies,${scanResult.metrics?.vulnerable_dependencies || 0}`);
  lines.push("");

  // Cache stats
  if (scanResult.cache_stats) {
    lines.push("--- Cache Stats ---");
    lines.push(`Cache Hits,${scanResult.cache_stats.hits || 0}`);
    lines.push(`Cache Misses,${scanResult.cache_stats.misses || 0}`);
    lines.push(`Hit Rate,${scanResult.cache_stats.hit_rate || 0}%`);
    lines.push("");
  }

  // Severity summary
  const severity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  issues.forEach((i) => {
    const sev = i.severity || "Low";
    if (severity[sev] !== undefined) severity[sev]++;
  });
  lines.push("--- Severity Summary ---");
  lines.push(`Critical,${severity.Critical}`);
  lines.push(`High,${severity.High}`);
  lines.push(`Medium,${severity.Medium}`);
  lines.push(`Low,${severity.Low}`);
  lines.push("");

  // Issues table
  lines.push("--- Issues Detail ---");
  lines.push(["#", "Severity", "File", "Description", "Suggestion", "Cached"].join(","));
  issues.forEach((issue, index) => {
    lines.push(
      [
        index + 1,
        escapeCSV(issue.severity || "Low"),
        escapeCSV(issue.file || "N/A"),
        escapeCSV(issue.description || ""),
        escapeCSV(issue.suggestion || ""),
        issue.cached ? "Yes" : "No",
      ].join(",")
    );
  });
  lines.push("");

  // Scanned files
  if (scanResult.scanned_files && scanResult.scanned_files.length > 0) {
    lines.push("--- Scanned Files ---");
    scanResult.scanned_files.forEach((file, i) => {
      lines.push(`${i + 1},${escapeCSV(file)}`);
    });
  }

  return lines.join("\n");
}

export function exportToCSV(scanResult) {
  if (!scanResult) return;
  const csvContent = scanResultToCSV(scanResult);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Security_Audit_Report_${timestamp}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
