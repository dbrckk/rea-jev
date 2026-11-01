/**
 * Bounded, non-executable projection of REA evidence for remote Jev decisions.
 * REA's canonical envelope puts the findings inside normalized_result.substeps[*].
 * Never send entire uploaded archives, raw binary bytes, or server-local paths.
 */
const MAX_STEPS = 12;
function brief(value, depth = 0) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, depth > 2 ? 180 : 700);
  if (depth >= 5) return '[nested structure elided]';
  if (Array.isArray(value)) return value.slice(0, 14).map(x => brief(x, depth + 1));
  if (!value || typeof value !== 'object') return String(value).slice(0, 70);
  const result = {};
  let count = 0;
  for (const [key, val] of Object.entries(value)) {
    if (++count > 28) break;
    if (/path|absolute|credential|token|api.?key|secret|password|local_path/i.test(key)) continue;
    if (key === 'raw_result' || key === 'parameters' || key === 'environment') continue;
    result[key] = brief(val, depth + 1);
  }
  return result;
}

export function projectEvidence(result, maxChars = 5500) {
  if (!result || typeof result !== 'object') return { summary: 'no structured evidence' };
  const n = result.normalized_result || result;
  const steps = Array.isArray(n.substeps) ? n.substeps.slice(0, MAX_STEPS).map(step => ({
    operation: step.operation,
    status: step.status,
    evidenceId: step.evidence_id || step.evidence?.evidence_id || null,
    observations: brief(step.evidence?.normalized_result || step.normalized_result || {}),
    limitations: brief(step.evidence?.limitations || [])
  })) : undefined;
  const projected = {
    evidenceId: result.evidence_id || null,
    format: n.subject?.root_format || result.subject?.format || result.subject?.root_format || null,
    limitations: brief(result.limitations || n.limitations || []),
    observations: steps ? undefined : brief(n),
    substeps: steps
  };
  // Keep JSON valid for API models even when the result is much larger than our budget.
  if (JSON.stringify(projected).length <= maxChars) return projected;
  if (steps) {
    const reduced = { ...projected, substeps: steps.map(x => ({
      operation:x.operation, status:x.status, evidenceId:x.evidenceId,
      observations: JSON.stringify(x.observations || {}).slice(0, 240)
    })) };
    if (JSON.stringify(reduced).length <= maxChars) return reduced;
  }
  return { evidenceId: projected.evidenceId, format: projected.format,
    summary: JSON.stringify(projected).slice(0, Math.max(400, maxChars - 200)),
    clipped:true };
}
