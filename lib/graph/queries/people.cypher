// Everyone in the directory.
MATCH (p:Person)
RETURN p.id AS id, p.name AS name, p.title AS title, p.email AS email, p.teamId AS teamId, p.active AS active
ORDER BY p.id
