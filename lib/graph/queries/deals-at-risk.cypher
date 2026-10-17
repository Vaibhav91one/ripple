// Open deals that promised a system hit by the decision (same traversal as ripple.cypher), with the PROMISED quote.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (dl:Deal)-[r:PROMISED]->(x) WHERE r.valid_to IS NULL AND dl.stage <> 'closed_lost'
RETURN dl.id AS dealId, dl.name AS name, dl.amount AS amount, dl.stage AS stage, x.id AS systemId,
  r.src AS src, r.quote AS quote
ORDER BY dl.amount DESC
LIMIT $limit
