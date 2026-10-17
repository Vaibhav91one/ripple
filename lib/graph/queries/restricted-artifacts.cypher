// Artifacts cited as evidence for restricted payload (guarantees, promises, clauses, findings, controls). Row: id, type.
MATCH ()-[r:GUARANTEES|HAS_CLAUSE|PROMISED|FOUND_IN|COVERS]->()
WHERE r.src IS NOT NULL
RETURN DISTINCT r.src AS id, type(r) AS type
