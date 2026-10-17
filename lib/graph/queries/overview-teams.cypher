// Head count per team for the overview strip, and whether the team owns a system the decision sunsets ($sunset, may be null).
MATCH (t:Team)
OPTIONAL MATCH (p:Person {teamId: t.id})
WITH t, count(p) AS people
OPTIONAL MATCH (t)-[o:OWNS]->(:System {id: $sunset})
RETURN t.id AS id, t.name AS name, people, count(o) > 0 AS owner
ORDER BY id
