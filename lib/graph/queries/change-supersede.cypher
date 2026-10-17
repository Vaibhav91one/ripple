// The new change SUPERSEDES the old one; the old one is closed.
MATCH (old:Change {id: $oldId}) MATCH (new:Change {id: $newId})
MERGE (new)-[r:SUPERSEDES]->(old)
SET r.valid_from = $now, r.observed_at = $now, old.status = 'superseded'
RETURN new.id AS id
