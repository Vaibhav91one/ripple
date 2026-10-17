// IT marks open requests granted or denied. A grant also records the person as holding the resource, until the next identity import says otherwise.
// Ripple never writes to an identity provider: this is bookkeeping for what IT did elsewhere.
MATCH (a:AccessRequest) WHERE a.id IN $ids AND a.status = 'open'
SET a.status = $status, a.decidedBy = $by, a.decidedAt = $now
WITH a
OPTIONAL MATCH (p:Person {id: a.personId})
OPTIONAL MATCH (r:AccessGroup {id: a.resourceId})
OPTIONAL MATCH (w:Software {id: a.resourceId})
FOREACH (_ IN CASE WHEN $status = 'granted' AND p IS NOT NULL AND r IS NOT NULL THEN [1] ELSE [] END | MERGE (p)-[h:HAS_ACCESS]->(r) SET h.observed_at = $now, h.valid_from = $now, h.src = 'it:' + a.id)
FOREACH (_ IN CASE WHEN $status = 'granted' AND p IS NOT NULL AND w IS NOT NULL THEN [1] ELSE [] END | MERGE (p)-[h:HAS_INSTALLED]->(w) SET h.observed_at = $now, h.valid_from = $now, h.src = 'it:' + a.id)
RETURN a.id AS id, a.personId AS personId, a.resourceId AS resourceId
