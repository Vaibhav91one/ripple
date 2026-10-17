// recall: current agent findings about these entities, newest first, each with how many edges touching those entities are newer than the finding
// (a new, changed or ended edge since its date means the finding may be out of date). ($ids, $limit). Row: id, text, at, agent, runId, confidence, sources, about, newerEdges.
MATCH (f:AgentFinding {status: 'current'})-[:ABOUT]->(e)
WHERE e.id IN $ids
WITH f, collect(DISTINCT e.id) AS about
ORDER BY f.at DESC LIMIT $limit
OPTIONAL MATCH (m)-[r]-(o)
WHERE m.id IN about AND NOT m:AgentFinding AND NOT o:AgentFinding AND type(r) <> 'BETWEEN'
  AND (r.valid_from > f.at OR r.observed_at > f.at OR r.valid_to > f.at)
RETURN f.id AS id, f.text AS text, f.at AS at, f.agent AS agent, f.runId AS runId, f.confidence AS confidence, f.sources AS sources, about, count(r) AS newerEdges
ORDER BY at DESC
