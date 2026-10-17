// Artifacts cited as evidence for restricted payload (guarantees, promises, clauses, findings, controls). Row: id, type.
MATCH ()-[r:GUARANTEES|HAS_CLAUSE|PROMISED|FOUND_IN|COVERS]->()
WHERE r.src IS NOT NULL
RETURN DISTINCT r.src AS id, type(r) AS type
UNION
// Approved draft notices/amendments (executors draft_doc) quote clause text: owned by Legal.
MATCH (a:Artifact) WHERE a.restrictedTo IS NOT NULL
RETURN a.id AS id, 'DRAFT_DOC' AS type
