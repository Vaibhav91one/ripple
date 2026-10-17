// Who in the affected teams should hold the software or access group a change's systems REQUIRE.
// One row per person x requirement: heldAt = when HAS_ACCESS/HAS_INSTALLED to it was last observed,
// lastIdentity = the newest identity observation for that person at all (stale identity data means unknown, not missing).
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (x)-[:REQUIRES]->(r)
WHERE r:Software OR r:AccessGroup
WITH DISTINCT r, x
MATCH (pe:Person)-[:MEMBER_OF]->(t:Team)
WHERE t.id IN $teams AND (pe.active IS NULL OR pe.active = true)
OPTIONAL MATCH (pe)-[h:HAS_ACCESS|HAS_INSTALLED]->(r)
OPTIONAL MATCH (pe)-[i:HAS_ACCESS|HAS_INSTALLED]->()
RETURN pe.id AS personId, pe.name AS name, t.id AS teamId, r.id AS resourceId, r.name AS resourceName,
  CASE WHEN r:AccessGroup THEN 'group' ELSE 'software' END AS resourceKind, x.id AS systemId,
  max(h.observed_at) AS heldAt, max(i.observed_at) AS lastIdentity
ORDER BY teamId, personId, resourceId
