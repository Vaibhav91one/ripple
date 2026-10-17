// The seed has no Control -> System edge, so this is honest but coarse: when the decision currently sunsets a
// system, return the security Controls flagged v1Related (the API-v1 surface), audit-blocking and failing first.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
WITH collect(DISTINCT s.id) AS systemIds
MATCH (c:Control {v1Related: true})
RETURN c.id AS controlId, c.name AS name, c.frameworkId AS frameworkId, c.status AS status,
  c.auditBlocking AS auditBlocking, c.ownerId AS ownerId, systemIds
ORDER BY c.auditBlocking DESC, c.status, c.id
