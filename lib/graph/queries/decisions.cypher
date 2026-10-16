// Every decision, oldest first.
MATCH (d:Decision)
RETURN d.id AS id, d.title AS title, d.status AS status, d.decidedAt AS decidedAt
ORDER BY d.decidedAt
