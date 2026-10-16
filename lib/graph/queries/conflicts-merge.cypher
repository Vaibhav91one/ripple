// Idempotent: one Conflict per (decision, system), open, BETWEEN the decision and each contract.
MERGE (k:Conflict {id: $cid})
ON CREATE SET k.detectedAt = $now
SET k.kind = 'sunset_vs_guarantee', k.severity = 'high', k.status = 'open',
    k.decisionId = $id, k.contractIds = $contractIds, k.sources = $sources
WITH k
MATCH (d:Decision {id: $id})
MERGE (k)-[b:BETWEEN]->(d)
ON CREATE SET b.valid_from = $now, b.observed_at = $now
WITH k
UNWIND $contractIds AS cid
MATCH (c:Contract {id: cid})
MERGE (k)-[b2:BETWEEN]->(c)
ON CREATE SET b2.valid_from = $now, b2.observed_at = $now
RETURN count(k) AS n
