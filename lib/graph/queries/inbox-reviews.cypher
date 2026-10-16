// Tasks in review assigned to a person.
MATCH (k:Task {status: 'in_review'})-[a:ASSIGNED]->(:Person {id: $id})
RETURN k.id AS id, k.title AS title, k.createdAt AS at, a.by AS fromId
ORDER BY at DESC
