// End the current SUNSETS edge of a decision and write its replacement.
MATCH (d:Decision {id: $id})-[s:SUNSETS]->(x:System)
WHERE s.valid_to IS NULL
SET s.valid_to = $now
WITH d, x
CREATE (d)-[n:SUNSETS {on: $newOn, valid_from: $now, observed_at: $now}]->(x)
RETURN x.id AS systemId
