// id, display name and label of every Team, System, Customer, Person and Contract: the names an agent answer may mention.
MATCH (n)
WHERE (n:Team OR n:System OR n:Customer OR n:Person OR n:Contract) AND n.name IS NOT NULL
RETURN n.id AS id, n.name AS name, labels(n)[0] AS kind
