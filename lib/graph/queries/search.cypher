// Full-text over Artifact.text.
CALL db.idx.fulltext.queryNodes('Artifact', $text) YIELD node, score
RETURN node.id AS id, node.kind AS kind, node.title AS title, score
ORDER BY score DESC LIMIT $limit
