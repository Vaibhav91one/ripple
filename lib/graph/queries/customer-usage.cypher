// Customers that use a system in the decision's ripple (same traversal as ripple.cypher), with USES {calls_30d, last_seen} from the CSV import.
// Ranked by usage, then ARR. arr is redacted for viewers who are not Sales (lib/permissions).
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (cu:Customer)-[u:USES]->(x) WHERE u.valid_to IS NULL
RETURN cu.id AS customerId, cu.name AS name, cu.arr AS arr, cu.tier AS tier, x.id AS systemId,
  u.calls_30d AS calls30d, u.last_seen AS lastSeen, u.src AS src
ORDER BY coalesce(u.calls_30d, -1) DESC, coalesce(cu.arr, 0) DESC, cu.id
LIMIT 15
