// Confirmed changes that have not yet taken effect (accepted = the seeded decision). Effective date = the current SUNSETS date, else effective_at.
MATCH (c:Change) WHERE c.status IN ['confirmed', 'accepted']
OPTIONAL MATCH (c)-[sn:SUNSETS]->(:System) WHERE sn.valid_to IS NULL
WITH c, coalesce(max(sn.on), c.effective_at) AS effectiveAt
WHERE effectiveAt IS NULL OR effectiveAt >= $now
RETURN c.id AS id
ORDER BY id
