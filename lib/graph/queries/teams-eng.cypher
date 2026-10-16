// Eng dashboard rows. Every branch returns one row: kind + rows (a list of maps). Param: $team.
MATCH (p:PR) WHERE p.state IS NOT NULL
RETURN 'prs' AS kind, collect({id: p.id, title: p.title, repo: p.repo, authorId: p.author, state: p.state,
  additions: p.additions, deletions: p.deletions, createdAt: p.createdAt, firstReviewAt: p.firstReviewAt,
  mergedAt: p.mergedAt, reviewerIds: p.reviewerIds, v1Related: coalesce(p.v1Related, false)}) AS rows
UNION ALL
MATCH (i:Incident)
RETURN 'incidents' AS kind, collect({id: i.id, title: i.title, severity: i.severity, systemId: i.systemId,
  startedAt: i.startedAt, acknowledgedAt: i.acknowledgedAt, resolvedAt: i.resolvedAt}) AS rows
UNION ALL
MATCH (s:System)
RETURN 'services' AS kind, collect({id: s.id, name: s.name, kind: s.kind, status: s.status, version: s.version,
  successor: s.successor, onCallPersonId: s.onCallPersonId}) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
