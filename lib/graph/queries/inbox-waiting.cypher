// Teams with an open request waiting on this team.
MATCH (w:Team)-[r:WAITING_ON]->(:Team {id: $team})
WHERE r.valid_to IS NULL
RETURN w.id AS id, w.name AS name, r.valid_from AS at
ORDER BY at
