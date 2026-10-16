// id -> display name for every node with a name or title (teams, people, systems, customers, decisions, deals, contracts, artifacts, tasks, findings).
MATCH (n)
WHERE n.name IS NOT NULL OR n.title IS NOT NULL
RETURN n.id AS id, coalesce(n.name, n.title) AS name
