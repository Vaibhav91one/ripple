// DevRel dashboard rows: docs pages, docs stats (JSON strings), SDK repos, docs tasks, the team. Param: $team.
MATCH (g:Page)
RETURN 'pages' AS kind, collect({id: g.id, path: g.path, views30d: g.views30d, feedbackUp: g.feedbackUp,
  feedbackDown: g.feedbackDown, v1Related: coalesce(g.v1Related, false)}) AS rows
UNION ALL
MATCH (d:DocsStats)
RETURN 'docsStats' AS kind, collect({id: d.id, failedSearches: d.failedSearchesJson, sdkAdoption: d.sdkAdoptionJson}) AS rows
UNION ALL
MATCH (s:System) WHERE s.id STARTS WITH 'sdk-'
RETURN 'sdks' AS kind, collect({id: s.id, name: s.name, kind: s.kind, status: s.status, version: s.version,
  successor: s.successor, onCallPersonId: s.onCallPersonId}) AS rows
UNION ALL
MATCH (k:Task {teamId: $team})
RETURN 'tasks' AS kind, collect({id: k.id, title: k.title, teamId: k.teamId, assigneeId: k.assigneeId, status: k.status,
  createdAt: k.createdAt, kind: k.kind, dueAt: k.dueAt}) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
