// The changes (decisions) that reach this node: shortest path over current edges, with each hop's source quote.
MATCH (c:Change), (n {id: $id})
WHERE $label IN labels(n) AND c.id <> n.id
WITH c, shortestPath((c)-[*..6]-(n)) AS p
WHERE p IS NOT NULL AND ALL(r IN relationships(p) WHERE r.valid_to IS NULL AND type(r) <> 'BETWEEN' AND NOT 'AgentFinding' IN labels(startNode(r)))
RETURN c.id AS changeId, c.title AS changeTitle, c.status AS changeStatus,
  [x IN nodes(p) | {id: x.id, label: [l IN labels(x) WHERE l <> 'Artifact'][0], name: coalesce(x.name, x.title)}] AS nodes,
  [r IN relationships(p) | {type: type(r), src: r.src, quote: r.quote}] AS rels
