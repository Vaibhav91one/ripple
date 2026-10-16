// Leadership dashboard rows: goals, the risk register, what blocks what, decisions, the team. Param: $team.
MATCH (g:Goal)
RETURN 'goals' AS kind, collect({id: g.id, title: g.title, ownerTeamId: g.ownerTeamId, progress: g.progress,
  status: g.status, target: g.target, current: g.current}) AS rows
UNION ALL
MATCH (r:Risk)
RETURN 'risks' AS kind, collect({id: r.id, title: r.title, likelihood: r.likelihood, impact: r.impact, status: r.status,
  ownerId: r.ownerId, teamId: r.teamId, v1Related: coalesce(r.v1Related, false)}) AS rows
UNION ALL
MATCH (g:Goal)-[b:BLOCKED_BY]->(x)
RETURN 'blockers' AS kind, collect({fromId: g.id, toId: x.id, since: b.valid_from}) AS rows
UNION ALL
MATCH (d:Decision)
RETURN 'decisions' AS kind, collect({id: d.id, title: d.title, status: d.status, decidedAt: d.decidedAt}) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
