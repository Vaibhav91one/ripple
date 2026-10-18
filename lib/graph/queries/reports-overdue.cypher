// Open tasks past their due date, per team.
MATCH (k:Task {status: 'open'}) WHERE k.dueAt < $now
RETURN k.teamId AS teamId, count(k) AS n
