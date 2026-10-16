// Support dashboard rows: every ticket with its customer and system, the customers, the team. Param: $team.
MATCH (t:Ticket) WHERE t.priority IS NOT NULL
OPTIONAL MATCH (t)-[:RAISED_BY]->(c:Customer)
OPTIONAL MATCH (t)-[:ABOUT]->(s:System)
RETURN 'tickets' AS kind, collect({id: t.id, title: t.title, status: t.status, priority: t.priority,
  createdAt: t.createdAt, firstResponseAt: t.firstResponseAt, slaDueAt: t.slaDueAt, assigneeId: t.assigneeId,
  customerId: c.id, systemId: s.id, v1Related: coalesce(t.v1Related, false)}) AS rows
UNION ALL
MATCH (c:Customer)
RETURN 'customers' AS kind, collect({id: c.id, name: c.name, arr: c.arr, tier: c.tier, region: c.region,
  monthlyCalls: c.monthlyCalls, healthScore: c.healthScore, renewalDate: c.renewalDate}) AS rows
UNION ALL
MATCH (c:Customer)-[:USES]->(:System {id: 'api-v1'})
RETURN 'v1CustomerIds' AS kind, collect(c.id) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
