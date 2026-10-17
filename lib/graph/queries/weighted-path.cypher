// Cheapest path from a decision to a team by the `weight` edge property (algo.SPpaths, FalkorDB 6.0.2:
// https://docs.falkordb.com/algorithms/sppath.html). Same edge types as why-affected.cypher, any direction, at most 8 hops.
// An edge without `weight` counts 1, so with all weights 1 this equals the shortest path. Ended edges (valid_to set) are dropped after the
// fact (the algorithm has no edge filter): such a path gives no row. Rows: weight, nodes [{id, label, name}], rels [{type, src, quote}].
MATCH (d:Decision {id: $id}), (t:Team {id: $team})
CALL algo.SPpaths({sourceNode: d, targetNode: t, relTypes: ['SUNSETS', 'DEPENDS_ON', 'ABOUT', 'PROMISED', 'GUARANTEES', 'MANAGED_BY', 'OWNED_BY', 'OWNS', 'CARES_ABOUT', 'HANDLED_BY', 'MEMBER_OF', 'PARTY_TO', 'USES'], weightProp: 'weight', relDirection: 'both', maxLen: 8, pathCount: 1}) YIELD path, pathWeight
WHERE ALL(r IN relationships(path) WHERE r.valid_to IS NULL)
RETURN pathWeight AS weight, [n IN nodes(path) | {id: n.id, label: labels(n)[0], name: coalesce(n.name, n.title)}] AS nodes,
  [r IN relationships(path) | {type: type(r), src: r.src, quote: r.quote}] AS rels
