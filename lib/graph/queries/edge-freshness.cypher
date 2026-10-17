// Impact Analyst: the ownership/contract/deal edges that make teams and entities affected, with how recent and how sure each one is.
// Same traversal as ripple (SUNSETS -> system <- DEPENDS_ON up to $maxHops). Row: id (the node pointing at the system), rel, systemId, hop, observedAt, confidence, src, quote.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..3]-(x:System)
WHERE length(p) < $maxHops AND ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (a)-[r:OWNS|CARES_ABOUT|GUARANTEES|PROMISED]->(x) WHERE r.valid_to IS NULL
RETURN a.id AS id, type(r) AS rel, x.id AS systemId, length(p) + 1 AS hop,
  r.observed_at AS observedAt, coalesce(r.confidence, 1.0) AS confidence, r.src AS src, r.quote AS quote
