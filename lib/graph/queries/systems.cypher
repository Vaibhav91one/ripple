// Every system id and name, so a tool can list the real ids when given an unknown one.
MATCH (s:System)
RETURN s.id AS id, s.name AS name
ORDER BY id
