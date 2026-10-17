// Shortest path from a decision to a team over the ripple edges (sunset, dependencies, contracts, deals,
// tickets, ownership), any direction. FalkorDB's shortestPath must sit in WITH/RETURN, takes no property
// filters on edges, so ended edges (valid_to set) are dropped after the fact: such a path gives no row.
// Rows: nodes [{id, label, name}], rels [{type, src, quote}]; none when unreachable.
MATCH (d:Decision {id: $id}), (t:Team {id: $team})
WITH d, t, shortestPath((d)-[:SUNSETS|DEPENDS_ON|ABOUT|PROMISED|GUARANTEES|MANAGED_BY|OWNED_BY|OWNS|CARES_ABOUT|HANDLED_BY|MEMBER_OF|PARTY_TO|USES*..8]-(t)) AS p
WHERE p IS NOT NULL AND ALL(r IN relationships(p) WHERE r.valid_to IS NULL)
RETURN [n IN nodes(p) | {id: n.id, label: labels(n)[0], name: coalesce(n.name, n.title)}] AS nodes,
  [r IN relationships(p) | {type: type(r), src: r.src, quote: r.quote}] AS rels
