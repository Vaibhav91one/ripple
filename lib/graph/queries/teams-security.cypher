// Security dashboard rows: controls, frameworks, findings, vendors, the risk register, GRC tasks, the team. Param: $team.
MATCH (c:Control)
RETURN 'controls' AS kind, collect({id: c.id, frameworkId: c.frameworkId, name: c.name, status: c.status,
  auditBlocking: c.auditBlocking, ownerId: c.ownerId, v1Related: coalesce(c.v1Related, false)}) AS rows
UNION ALL
MATCH (f:Framework)
RETURN 'frameworks' AS kind, collect({id: f.id, name: f.name}) AS rows
UNION ALL
MATCH (f:Finding)
RETURN 'findings' AS kind, collect({id: f.id, title: f.title, severity: f.severity, slaDueAt: f.slaDueAt, systemId: f.systemId,
  status: f.status, ownerId: f.ownerId, v1Related: coalesce(f.v1Related, false)}) AS rows
UNION ALL
MATCH (v:Vendor)
RETURN 'vendors' AS kind, collect({id: v.id, name: v.name, riskTier: v.riskTier, assessmentStatus: v.assessmentStatus,
  nextReview: v.nextReview}) AS rows
UNION ALL
MATCH (r:Risk)
RETURN 'risks' AS kind, collect({id: r.id, title: r.title, likelihood: r.likelihood, impact: r.impact, status: r.status,
  ownerId: r.ownerId, teamId: r.teamId, v1Related: coalesce(r.v1Related, false)}) AS rows
UNION ALL
MATCH (k:Task {teamId: $team}) WHERE k.kind IN ['questionnaire', 'access_review']
RETURN 'tasks' AS kind, collect({id: k.id, title: k.title, teamId: k.teamId, assigneeId: k.assigneeId, status: k.status,
  createdAt: k.createdAt, kind: k.kind, dueAt: k.dueAt}) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
