// Active people with PRs (AUTHORED|REVIEWED) ABOUT the system, or tickets about it HANDLED_BY them.
// One evidence row per (person, role, artifact); the wrapper scores and takes the top 5.
MATCH (p:Person {active: true})-[r:AUTHORED]->(a)
WHERE a.id = $id OR (a)-[:ABOUT]->(:System {id: $id})
RETURN p.id AS personId, 'authored' AS role, a.id AS id, coalesce(a.ts, r.valid_from) AS ts
UNION ALL
MATCH (p:Person {active: true})-[r:REVIEWED]->(a)
WHERE a.id = $id OR (a)-[:ABOUT]->(:System {id: $id})
RETURN p.id AS personId, 'reviewed' AS role, a.id AS id, coalesce(a.ts, r.valid_from) AS ts
UNION ALL
MATCH (h:Ticket)-[:HANDLED_BY]->(p:Person {active: true})
WHERE (h)-[:ABOUT]->(:System {id: $id})
RETURN p.id AS personId, 'handled' AS role, h.id AS id, h.ts AS ts
