// Approved access_request -> AccessRequest node (open) for the IT queue. Re-running keeps the status.
MERGE (a:AccessRequest {id: $id})
ON CREATE SET a.status = 'open', a.createdAt = $now
SET a.personId = $personId, a.teamId = $teamId, a.resourceId = $resourceId, a.resourceKind = $resourceKind, a.decisionId = $decisionId,
  a.justification = $justification, a.src = $src, a.quote = $quote, a.expiresAt = $expiresAt, a.approvers = $approvers
WITH a
OPTIONAL MATCH (p:Person {id: $personId})
OPTIONAL MATCH (:Decision {id: $decisionId})-[sn:SUNSETS]->(:System) WHERE sn.valid_to IS NULL
WITH a, p, head(collect(sn.on)) AS deadline
SET a.deadline = deadline
FOREACH (_ IN CASE WHEN p IS NULL THEN [] ELSE [1] END | MERGE (a)-[:FOR]->(p))
RETURN a.id AS id, a.status AS status
