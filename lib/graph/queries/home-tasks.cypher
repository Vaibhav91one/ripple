// Open work for a person's Home: tasks assigned to them or to their team. Done tasks and tasks in review (the inbox lists those as reviews) are left out.
MATCH (k:Task {status: 'open'})
WHERE k.assigneeId = $person OR k.teamId = $team
RETURN k.id AS id, k.title AS title, k.status AS status, k.dueAt AS dueAt, k.assigneeId = $person AS mine
ORDER BY mine DESC, coalesce(k.dueAt, 9999999999), k.id
