// What Ripple concluded about one node: its current agent findings, newest first. ($id, $label)
MATCH (f:AgentFinding {status: 'current'})-[:ABOUT]->(n {id: $id})
WHERE $label IN labels(n)
RETURN f.id AS id, f.text AS text, f.at AS at, f.agent AS agent, f.confidence AS confidence, f.sources AS sources
ORDER BY at DESC LIMIT 20
