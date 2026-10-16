// Edges added or ended after $since.
MATCH (a)-[r]->(b)
WHERE r.valid_from > $since OR r.valid_to > $since
RETURN a.id AS from, b.id AS to, type(r) AS type, r.valid_from AS validFrom, r.valid_to AS validTo,
  r.src AS src, r.quote AS quote
