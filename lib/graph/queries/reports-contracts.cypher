// Contracts by id with the customer's ARR (Legal owns the contract, Sales the ARR).
MATCH (c:Contract) WHERE c.id IN $ids
OPTIONAL MATCH (c)-[:PARTY_TO]->(cu:Customer)
RETURN c.id AS id, c.name AS name, c.endsAt AS endsAt, cu.arr AS arr
ORDER BY c.id
