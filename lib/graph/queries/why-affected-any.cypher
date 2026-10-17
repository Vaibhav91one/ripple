// Fallback for why-affected.cypher when the team is not on a dependency path: the shortest path over any edge
// (e.g. a team reached only through a WAITING_ON hop from a team that was involved).
MATCH (d:Decision {id: $id}), (t:Team {id: $team})
WITH d, t, shortestPath((d)-[*..8]-(t)) AS p
WHERE p IS NOT NULL AND ALL(r IN relationships(p) WHERE r.valid_to IS NULL)
RETURN [n IN nodes(p) | {id: n.id, label: labels(n)[0], name: coalesce(n.name, n.title)}] AS nodes,
  [r IN relationships(p) | {type: type(r), src: r.src, quote: r.quote}] AS rels
