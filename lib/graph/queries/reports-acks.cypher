// Who was told or acknowledged a decision, and when: team-level INVOLVED_IN/ACKED edges and person-level ACKED edges.
MATCH (a)-[r:ACKED|INVOLVED_IN]->(:Decision {id: $id}) WHERE r.valid_to IS NULL AND (a:Team OR a:Person)
RETURN labels(a)[0] AS kind, a.id AS id, a.teamId AS teamId, type(r) AS type, r.valid_from AS at, r.kind AS ackKind
ORDER BY at, id
