// Every edge touching one node, both directions, current and ended (the dated timeline + the neighbours).
// BETWEEN edges are conflict bookkeeping. Newest 200 per direction; the wrapper sorts.
MATCH (n {id: $id})-[r]->(o)
WHERE $label IN labels(n) AND type(r) <> 'BETWEEN'
RETURN type(r) AS type, 'out' AS dir, o.id AS otherId, [l IN labels(o) WHERE l <> 'Artifact'][0] AS otherLabel,
  coalesce(o.title, o.name, o.text, o.id) AS otherTitle, coalesce(r.valid_from, 0) AS validFrom, r.valid_to AS validTo,
  r.src AS src, r.quote AS quote
ORDER BY validFrom DESC LIMIT 200
UNION ALL
MATCH (n {id: $id})<-[r]-(o)
WHERE $label IN labels(n) AND type(r) <> 'BETWEEN'
RETURN type(r) AS type, 'in' AS dir, o.id AS otherId, [l IN labels(o) WHERE l <> 'Artifact'][0] AS otherLabel,
  coalesce(o.title, o.name, o.text, o.id) AS otherTitle, coalesce(r.valid_from, 0) AS validFrom, r.valid_to AS validTo,
  r.src AS src, r.quote AS quote
ORDER BY validFrom DESC LIMIT 200
