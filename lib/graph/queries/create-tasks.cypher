// One open Task per row ($rows: id, teamId, decisionId, title, body; $now), linked with NOTIFIES. Idempotent per id.
// owner: the team's lead (title says lead/manager/head/director/counsel/chief), else its first member by id.
// dueAt: 14 days before the decision takes effect (SUNSETS.on), or now + 7 days when that is unknown or already past.
UNWIND $rows AS row
MATCH (t:Team {id: row.teamId})
OPTIONAL MATCH (p:Person {teamId: row.teamId})
WITH row, t, p ORDER BY CASE WHEN toLower(p.title) =~ '.*(lead|manager|head|director|counsel|chief|cto|coo|ceo).*' THEN 0 ELSE 1 END, p.id
WITH row, t, head(collect(p)) AS owner
OPTIONAL MATCH (:Decision {id: row.decisionId})-[sn:SUNSETS]->(:System) WHERE sn.valid_to IS NULL
WITH row, t, owner, head(collect(sn.on)) AS effective
MERGE (k:Task {id: row.id})
SET k.title = row.title, k.body = row.body, k.teamId = row.teamId, k.status = 'open', k.createdAt = $now,
  k.assigneeId = owner.id,
  k.dueAt = CASE WHEN effective IS NOT NULL AND effective - 1209600 > $now THEN effective - 1209600 ELSE $now + 604800 END
MERGE (k)-[n:NOTIFIES]->(t)
SET n.valid_from = $now, n.valid_to = null
RETURN k.id AS id, k.title AS title, t.id AS teamId, k.assigneeId AS assigneeId, k.dueAt AS dueAt, k.body AS body
