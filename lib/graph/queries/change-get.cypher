// One Change plus the ids of the systems it affects or sunsets (current edges only).
MATCH (c:Change {id: $id})
OPTIONAL MATCH (c)-[r:AFFECTED|SUNSETS]->(s:System) WHERE r.valid_to IS NULL
RETURN c.id AS id, c.kind AS kind, c.title AS title, c.status AS status, c.effective_at AS effectiveAt,
  c.owner AS owner, c.source_ref AS sourceRef, c.quote AS quote, collect(DISTINCT s.id) AS systems
