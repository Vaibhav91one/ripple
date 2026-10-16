// The decision node plus the evidence of its current SUNSETS edge, for assembling a RippleResult.
// One row per current SUNSETS edge (the wrapper takes the first).
MATCH (d:Decision {id: $id})
OPTIONAL MATCH (d)-[sn:SUNSETS]->(:System) WHERE sn.valid_to IS NULL
RETURN d.id AS id, d.title AS title, d.status AS status, d.decidedAt AS decidedAt,
  sn.src AS src, sn.quote AS quote
