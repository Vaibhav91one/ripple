// Conflict nodes for a decision.
MATCH (k:Conflict {decisionId: $id})
RETURN k.id AS id, k.kind AS kind, k.severity AS severity, k.status AS status,
  k.decisionId AS decisionId, k.contractIds AS contractIds, k.detectedAt AS detectedAt, k.sources AS sources
ORDER BY k.id
