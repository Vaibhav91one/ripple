// Every node whose payload is team-restricted (contracts, clauses, deals, findings, controls). Row: id, labels.
MATCH (n)
WHERE any(l IN labels(n) WHERE l IN ['Contract', 'Clause', 'Deal', 'Finding', 'Control'])
RETURN n.id AS id, labels(n) AS labels
