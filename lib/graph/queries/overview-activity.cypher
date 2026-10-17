// Edges added since $since (type + timestamp); the wrapper buckets them per day into changes and acks.
MATCH ()-[r]->()
WHERE r.valid_from >= $since AND type(r) <> 'BETWEEN' AND NOT 'AgentFinding' IN labels(startNode(r))
RETURN type(r) AS type, r.valid_from AS at
