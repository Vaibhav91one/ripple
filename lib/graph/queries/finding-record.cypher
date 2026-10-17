// record_finding executor: one AgentFinding node + an ABOUT edge to every entity it concerns, then supersede the findings it replaces.
// ($id, $text, $now, $agent, $runId, $confidence, $sources, $restrictedTo, $entityIds, $supersedes). Row: n = ABOUT edges written.
MERGE (f:AgentFinding {id: $id})
SET f.text = $text, f.at = $now, f.agent = $agent, f.runId = $runId, f.confidence = $confidence, f.sources = $sources, f.status = 'current', f.restrictedTo = $restrictedTo
WITH f
OPTIONAL MATCH (o:AgentFinding) WHERE o.id IN $supersedes AND o.id <> $id
SET o.status = 'superseded', o.supersededBy = $id, o.supersededAt = $now
WITH DISTINCT f
MATCH (e) WHERE e.id IN $entityIds AND NOT e:AgentFinding AND NOT e:Migration
MERGE (f)-[r:ABOUT]->(e)
SET r.valid_from = $now, r.valid_to = null, r.observed_at = $now
RETURN count(r) AS n
