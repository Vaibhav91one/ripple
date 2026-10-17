// After record_finding: the server guarantees no duplicates. Every other current finding by the same agent whose entities are all
// within this finding's entities is superseded by it. ($id, $agent, $entityIds, $now)
MATCH (old:AgentFinding {status: 'current', agent: $agent})
WHERE old.id <> $id
MATCH (old)-[:ABOUT]->(oe)
WITH old, collect(oe.id) AS oabout
WHERE all(x IN oabout WHERE x IN $entityIds)
SET old.status = 'superseded', old.supersededBy = $id, old.supersededAt = $now
