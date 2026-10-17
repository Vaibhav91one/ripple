// Read-only twin of create-tasks: who would own each task and when it would be due. $rows: teamId, decisionId; $now.
UNWIND $rows AS row
MATCH (t:Team {id: row.teamId})
OPTIONAL MATCH (p:Person {teamId: row.teamId})
WITH row, t, p ORDER BY CASE WHEN toLower(p.title) =~ '.*(lead|manager|head|director|counsel|chief|cto|coo|ceo).*' THEN 0 ELSE 1 END, p.id
WITH row, t, head(collect(p)) AS owner
OPTIONAL MATCH (:Decision {id: row.decisionId})-[sn:SUNSETS]->(:System) WHERE sn.valid_to IS NULL
WITH row, owner, head(collect(sn.on)) AS effective
RETURN row.teamId AS teamId, owner.id AS owner,
  CASE WHEN effective IS NOT NULL AND effective - 1209600 > $now THEN effective - 1209600 ELSE $now + 604800 END AS dueAt
