// Per affected team: was it involved in, or did it acknowledge, the decision?
MATCH (t:Team) WHERE t.id IN $affected
OPTIONAL MATCH (t)-[i:INVOLVED_IN]->(:Decision {id: $id}) WHERE i.valid_to IS NULL
OPTIONAL MATCH (t)-[a:ACKED]->(:Decision {id: $id}) WHERE a.valid_to IS NULL
RETURN t.id AS team, t.name AS name, count(i) > 0 AS involved, count(a) > 0 AS acked
