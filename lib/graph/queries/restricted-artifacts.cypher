// Artifacts cited as evidence for restricted payload (guarantees, promises, clauses, findings, controls). Row: id, type.
MATCH ()-[r:GUARANTEES|HAS_CLAUSE|PROMISED|FOUND_IN|COVERS]->()
WHERE r.src IS NOT NULL
RETURN DISTINCT r.src AS id, type(r) AS type
UNION
// Approved drafts (executors draft_doc) that quote restricted text. restrictedTo names the owning team: legal for notices and amendments, security for audit notes.
MATCH (a:Artifact) WHERE a.restrictedTo IS NOT NULL
RETURN a.id AS id, 'RESTRICTED:' + a.restrictedTo AS type
UNION
// Agent findings (record_finding) derived from restricted sources keep the owner of those sources. restrictedTo is set by the executor.
MATCH (f:AgentFinding) WHERE f.restrictedTo IS NOT NULL
RETURN f.id AS id, 'RESTRICTED:' + f.restrictedTo AS type
