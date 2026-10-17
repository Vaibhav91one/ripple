// Clauses of one contract (Legal-only through the permission layer: Clause ids are restricted). Param: $id.
MATCH (c:Contract {id: $id})-[h:HAS_CLAUSE]->(k:Clause)
RETURN k.id AS id, c.id AS contractId, k.number AS number, k.title AS title, k.text AS text, k.risk AS risk, k.dueAt AS dueAt, h.src AS src
ORDER BY k.number
LIMIT $limit
