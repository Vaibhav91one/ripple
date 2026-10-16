// Sales dashboard rows: deals with their customer, the quarter goal, the team. Param: $team.
MATCH (d:Deal)
OPTIONAL MATCH (d)-[:PARTY_TO]->(c:Customer)
RETURN 'deals' AS kind, collect({id: d.id, name: d.name, stage: d.stage, probability: d.probability, ownerId: d.ownerId,
  amount: d.amount, closeDate: d.closeDate, customerId: c.id, v1Related: coalesce(d.v1Related, false)}) AS rows
UNION ALL
MATCH (g:Goal {ownerTeamId: $team}) WHERE g.target IS NOT NULL
RETURN 'goals' AS kind, collect({id: g.id, title: g.title, ownerTeamId: g.ownerTeamId, progress: g.progress,
  status: g.status, target: g.target, current: g.current}) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
