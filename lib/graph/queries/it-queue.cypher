// The IT queue: every access request, with the person, the resource name and the change it is tied to. Earliest deadline first.
MATCH (a:AccessRequest)
OPTIONAL MATCH (p:Person {id: a.personId})
OPTIONAL MATCH (g:AccessGroup {id: a.resourceId})
OPTIONAL MATCH (s:Software {id: a.resourceId})
OPTIONAL MATCH (d:Decision {id: a.decisionId})
RETURN a.id AS id, a.personId AS personId, p.name AS personName, a.teamId AS teamId, a.resourceId AS resourceId,
  coalesce(g.name, s.name, a.resourceId) AS resourceName, a.resourceKind AS resourceKind, a.decisionId AS decisionId, d.title AS changeTitle,
  a.justification AS justification, a.src AS src, a.quote AS quote, a.expiresAt AS expiresAt, a.deadline AS deadline,
  a.approvers AS approvers, a.status AS status, a.decidedBy AS decidedBy, a.decidedAt AS decidedAt
ORDER BY CASE WHEN a.deadline IS NULL THEN 1 ELSE 0 END, a.deadline, a.createdAt, a.id
