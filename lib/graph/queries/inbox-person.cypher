// A person's team, and the decisions that sunset a system their team owns.
MATCH (p:Person {id: $id})-[:MEMBER_OF]->(t:Team)
OPTIONAL MATCH (t)-[:OWNS]->(:System)<-[s:SUNSETS]-(d:Decision) WHERE s.valid_to IS NULL
RETURN t.id AS team, collect(DISTINCT d.id) AS decisions
