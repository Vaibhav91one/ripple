// A person, a required resource (software or access group), and who owns the system that requires it.
OPTIONAL MATCH (p:Person {id: $person})
OPTIONAL MATCH (r) WHERE r.id = $resource AND (r:Software OR r:AccessGroup)
OPTIONAL MATCH (x:System)-[:REQUIRES]->(r)
OPTIONAL MATCH (t:Team)-[:OWNS]->(x)
RETURN p.id AS personId, r.id AS resourceId, r.name AS resourceName, CASE WHEN r:AccessGroup THEN 'group' ELSE 'software' END AS resourceKind,
  collect(DISTINCT t.id) AS owners
