// Hybrid: nearest Artifacts by embedding, then hop to the systems they are ABOUT.
CALL db.idx.vector.queryNodes('Artifact', 'emb', $k, vecf32($vec)) YIELD node, score
OPTIONAL MATCH (node)-[:ABOUT]->(s:System)
RETURN node.id AS id, node.kind AS kind, node.title AS title, score, collect(s.id) AS systemIds
ORDER BY score
