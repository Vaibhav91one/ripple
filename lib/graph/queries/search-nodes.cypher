// ⌘K search: name/title/id matches on the core node kinds. $q is lower-case. Row: id, labels, title, text.
// No label OR in MATCH on FalkorDB 6.0.2, so the kinds are a WHERE. Ranking and per-group caps happen in lib/search.ts.
MATCH (n)
WHERE (n:Decision OR n:Change OR n:System OR n:Customer OR n:Contract OR n:Deal OR n:Team OR n:Person)
  AND (toLower(coalesce(n.name, n.title, '')) CONTAINS $q OR toLower(n.id) = $q)
RETURN n.id AS id, labels(n) AS labels, coalesce(n.name, n.title, n.id) AS title, n.status AS status
LIMIT $cap
