// Support Specialist: open tickets about the sunset system or a system that depends on it, with the customer who raised each. No ARR (Sales-owned). Param: $id.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (a:Ticket {status: 'open'})-[r:ABOUT]->(x) WHERE r.valid_to IS NULL
OPTIONAL MATCH (a)-[:RAISED_BY]->(c:Customer)
RETURN DISTINCT a.id AS id, a.title AS title, a.priority AS priority, x.id AS systemId, c.id AS customerId, c.name AS customer
ORDER BY id
LIMIT $limit
