// Edge evidence for the /graph flowchart: every current edge into the systems a decision's sunset reaches,
// plus the SUNSETS edge and the DEPENDS_ON chain. Row: from, to, type, validFrom, src, quote.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
WITH DISTINCT x
MATCH (a)-[r:ABOUT|PROMISED|GUARANTEES|USES|OWNS|CARES_ABOUT]->(x)
WHERE NOT a:AgentFinding AND r.valid_to IS NULL
RETURN a.id AS from, x.id AS to, type(r) AS type, r.valid_from AS validFrom, r.src AS src, r.quote AS quote
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
RETURN d.id AS from, s.id AS to, 'SUNSETS' AS type, sn.valid_from AS validFrom, sn.src AS src, sn.quote AS quote
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
WITH DISTINCT x
MATCH (x)-[r:DEPENDS_ON]->(y:System)
WHERE r.valid_to IS NULL
RETURN x.id AS from, y.id AS to, 'DEPENDS_ON' AS type, r.valid_from AS validFrom, r.src AS src, r.quote AS quote
