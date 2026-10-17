// Open Tasks per team, for the teams a decision touches. Param: $teams.
MATCH (k:Task {status: 'open'}) WHERE k.teamId IN $teams
RETURN k.teamId AS teamId, count(k) AS open
ORDER BY teamId
