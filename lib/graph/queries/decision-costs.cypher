// Decision Advisor: who is behind the open conflicts' contracts, how long each guarantee runs, and when the sunset takes effect. Params: $id, $ids (contract ids).
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)<-[g:GUARANTEES]-(c:Contract)
WHERE sn.valid_to IS NULL AND g.valid_to IS NULL AND c.id IN $ids
MATCH (c)-[:PARTY_TO]-(cu:Customer)
RETURN c.id AS contractId, cu.id AS customerId, cu.name AS customer, cu.arr AS arr, g.until AS guaranteedUntil, sn.on AS sunsetOn
ORDER BY contractId
