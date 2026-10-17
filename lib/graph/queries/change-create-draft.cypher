// Create a draft Change and link it to the systems it affects. Re-running with the same id updates it.
MERGE (c:Change {id: $id})
SET c.kind = $kind, c.title = $title, c.status = 'draft', c.effective_at = $effectiveAt,
  c.owner = $owner, c.source_ref = $sourceRef, c.quote = $quote, c.created_at = coalesce(c.created_at, $now)
WITH c
UNWIND $systems AS sid
MATCH (s:System {id: sid})
MERGE (c)-[r:AFFECTED]->(s)
SET r.valid_from = coalesce(r.valid_from, $now), r.observed_at = $now
RETURN count(s) AS linked
