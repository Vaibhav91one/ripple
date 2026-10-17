// Contracts ending within $within seconds of $now, with notice period and customer. Contract ids are restricted (Legal-only).
MATCH (c:Contract) WHERE c.endsAt IS NOT NULL AND c.endsAt >= $now AND c.endsAt <= $now + $within
OPTIONAL MATCH (c)-[:PARTY_TO]->(cu:Customer)
RETURN c.id AS id, c.name AS name, c.endsAt AS endsAt, c.noticeDays AS noticeDays, cu.id AS customerId
ORDER BY c.endsAt
LIMIT $limit
