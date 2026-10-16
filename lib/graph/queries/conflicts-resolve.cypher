// Open conflicts for this decision that were not re-detected are no longer true.
MATCH (k:Conflict {decisionId: $id, status: 'open'})
WHERE NOT k.id IN $keep
SET k.status = 'resolved'
RETURN count(k) AS n
