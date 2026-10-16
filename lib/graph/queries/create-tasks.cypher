// Demo graph only: one open Task per gap team, linked with NOTIFIES.
UNWIND $rows AS row
MATCH (t:Team {id: row.teamId})
MERGE (k:Task {id: row.id})
SET k.title = row.title, k.teamId = row.teamId, k.status = 'open', k.createdAt = $now
MERGE (k)-[n:NOTIFIES]->(t)
SET n.valid_from = $now, n.valid_to = null
RETURN k.id AS id, k.title AS title, t.id AS teamId
