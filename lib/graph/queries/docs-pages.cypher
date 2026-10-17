// Docs Specialist: docs Pages that describe the sunset system. The seed has no Page -> System edge, so this is coarse:
// when the decision currently sunsets a system, return the Pages flagged v1Related (the API-v1 docs), most viewed first. Param: $id.
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH (p:Page {v1Related: true})
RETURN p.id AS id, p.path AS path, p.views30d AS views30d, p.feedbackDown AS feedbackDown, s.id AS systemId, sn.src AS src
ORDER BY p.views30d DESC, p.id
LIMIT $limit
