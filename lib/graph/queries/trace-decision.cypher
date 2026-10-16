// A decision and the artifacts that support it (SUPPORTED_BY, with the edge quote when present).
MATCH (d:Decision {id: $id})
OPTIONAL MATCH (d)-[r:SUPPORTED_BY]->(a:Artifact) WHERE r.valid_to IS NULL
RETURN d.id AS id, d.title AS title, d.status AS status, d.decidedAt AS decidedAt,
  a.id AS sourceId, a.title AS sourceTitle, r.quote AS quote
