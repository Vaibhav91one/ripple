// The whole company graph for the /graph explorer: the core node kinds (capped) and the current edges between them.
// Row: id, labels, title, conflict. No label OR in MATCH on FalkorDB 6.0.2, so the kinds are a WHERE.
MATCH (n)
WHERE n:Decision OR n:System OR n:Customer OR n:Ticket OR n:Deal OR n:Contract OR n:Team
OPTIONAL MATCH (k:Conflict) WHERE k.status = 'open' AND (k.decisionId = n.id OR n.id IN k.contractIds)
WITH n, count(k) > 0 AS conflict
RETURN n.id AS id, labels(n) AS labels, coalesce(n.name, n.title, n.id) AS title, conflict
ORDER BY n.id
LIMIT $cap
