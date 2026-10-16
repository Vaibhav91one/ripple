// Open BLOCKED_BY edges: a goal that cannot move until a decision, finding or task is resolved.
MATCH (g)-[b:BLOCKED_BY]->(x) WHERE b.valid_to IS NULL
RETURN g.id AS fromId, x.id AS toId, b.valid_from AS since
ORDER BY since
