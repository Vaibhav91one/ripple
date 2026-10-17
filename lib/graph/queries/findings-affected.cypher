// Security Specialist: open Findings raised against the sunset system or a system that depends on it (same traversal as ripple.cypher). Param: $id.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (f:Finding)-[:FOUND_IN]->(x) WHERE f.status <> 'resolved'
RETURN DISTINCT f.id AS findingId, f.title AS title, f.severity AS severity, f.status AS status, f.slaDueAt AS slaDueAt,
  f.v1Related AS v1Related, x.id AS systemId, sn.src AS src
ORDER BY findingId
