// Head count per team for the overview strip.
MATCH (t:Team)
OPTIONAL MATCH (p:Person {teamId: t.id})
RETURN t.id AS id, t.name AS name, count(p) AS people
ORDER BY id
