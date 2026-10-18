// Current edges among the nodes the explorer shows. Row: from, to, type.
MATCH (a)-[r]->(b)
WHERE a.id IN $ids AND b.id IN $ids AND r.valid_to IS NULL
RETURN a.id AS from, b.id AS to, type(r) AS type
