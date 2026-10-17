// Every Team node, for the members screen's team picker.
MATCH (t:Team)
RETURN t.id AS id, t.name AS name
ORDER BY t.id
