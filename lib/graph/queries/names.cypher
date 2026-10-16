// id -> display name for every non-artifact node (teams, people, systems, customers, decisions, deals, contracts).
MATCH (n)
WHERE NOT n:Artifact AND (n.name IS NOT NULL OR n.title IS NOT NULL)
RETURN n.id AS id, coalesce(n.name, n.title) AS name
