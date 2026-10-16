// Everything a decision touches: SUNSETS -> system <- DEPENDS_ON*0..2 dependents, then
// entities (tickets, deals, contracts, customers) and the teams that own/handle/care.
// Row: kind, ref, label, sys, hop, rel, team, reason, src, quote, amount. UNION ALL branches.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
RETURN 'system' AS kind, x.id AS ref, x.name AS label,
  CASE WHEN length(p) = 0 THEN null ELSE nodes(p)[length(p) - 1].id END AS sys,
  length(p) + 1 AS hop, 'DEPENDS_ON' AS rel, null AS team, null AS reason, null AS src, null AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (a:Ticket {status: 'open'})-[r:ABOUT]->(x) WHERE r.valid_to IS NULL
RETURN 'ticket' AS kind, a.id AS ref, a.title AS label, x.id AS sys, length(p) + 2 AS hop, 'ABOUT' AS rel,
  null AS team, null AS reason, r.src AS src, r.quote AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (dl:Deal)-[r:PROMISED]->(x) WHERE r.valid_to IS NULL AND dl.stage <> 'closed_lost'
RETURN 'deal' AS kind, dl.id AS ref, dl.name AS label, x.id AS sys, length(p) + 2 AS hop, 'PROMISED' AS rel,
  null AS team, null AS reason, r.src AS src, r.quote AS quote, dl.amount AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (c:Contract)-[r:GUARANTEES]->(x) WHERE r.valid_to IS NULL
MATCH (c)-[:PARTY_TO]->(cu:Customer)
RETURN 'contract' AS kind, c.id AS ref, c.name AS label, x.id AS sys, length(p) + 2 AS hop, 'GUARANTEES' AS rel,
  null AS team, null AS reason, r.src AS src, r.quote AS quote, cu.arr AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (cu:Customer)-[r:USES]->(x) WHERE r.valid_to IS NULL AND r.last_seen >= $now - 120 * 86400
RETURN 'customer' AS kind, cu.id AS ref, cu.name AS label, x.id AS sys, length(p) + 2 AS hop, 'USES' AS rel,
  null AS team, null AS reason, r.src AS src, r.quote AS quote, cu.arr AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (t:Team)-[r:OWNS]->(x) WHERE r.valid_to IS NULL AND NOT (t)-[:OWNS]->(s)
RETURN 'team' AS kind, x.id AS ref, x.name AS label, x.id AS sys, 0 AS hop, 'OWNS' AS rel,
  t.id AS team, 'owns ' + x.name + ', which depends on ' + s.name AS reason, r.src AS src, r.quote AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (t:Team)-[r:CARES_ABOUT]->(x) WHERE r.valid_to IS NULL
RETURN 'team' AS kind, x.id AS ref, x.name AS label, x.id AS sys, 0 AS hop, 'CARES_ABOUT' AS rel,
  t.id AS team, 'cares about ' + x.name AS reason, r.src AS src, r.quote AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (a:Ticket {status: 'open'})-[r:ABOUT]->(x) WHERE r.valid_to IS NULL
MATCH (a)-[:HANDLED_BY]->(:Person)-[:MEMBER_OF]->(t:Team)
RETURN 'team' AS kind, a.id AS ref, a.title AS label, x.id AS sys, 0 AS hop, 'HANDLED_BY' AS rel,
  t.id AS team, 'handles open tickets about ' + x.name AS reason, r.src AS src, r.quote AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (a:Ticket {status: 'open'})-[r:ABOUT]->(x) WHERE r.valid_to IS NULL
MATCH (a)-[:HANDLED_BY]->(t:Team)
RETURN 'team' AS kind, a.id AS ref, a.title AS label, x.id AS sys, 0 AS hop, 'HANDLED_BY' AS rel,
  t.id AS team, 'handles open tickets about ' + x.name AS reason, r.src AS src, r.quote AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (dl:Deal)-[r:PROMISED]->(x) WHERE r.valid_to IS NULL AND dl.stage <> 'closed_lost'
MATCH (dl)-[:OWNED_BY]->(t:Team)
RETURN 'team' AS kind, dl.id AS ref, dl.name AS label, x.id AS sys, 0 AS hop, 'OWNED_BY' AS rel,
  t.id AS team, 'owns open deals that promised ' + x.name AS reason, r.src AS src, r.quote AS quote, 0 AS amount
UNION ALL
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (c:Contract)-[r:GUARANTEES]->(x) WHERE r.valid_to IS NULL
MATCH (c)-[:MANAGED_BY]->(t:Team)
RETURN 'team' AS kind, c.id AS ref, c.name AS label, x.id AS sys, 0 AS hop, 'MANAGED_BY' AS rel,
  t.id AS team, 'manages contracts that guarantee ' + x.name AS reason, r.src AS src, r.quote AS quote, 0 AS amount
