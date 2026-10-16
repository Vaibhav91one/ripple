// Open WAITING_ON between teams, grouped by the team that is blocking.
MATCH (w:Team)-[r:WAITING_ON]->(b:Team)
WHERE r.valid_to IS NULL
RETURN b.id AS blockerTeamId, count(r) AS openRequests, sum($now - r.valid_from) AS totalWaitSecs,
  min(r.valid_from) AS oldestSince, collect(DISTINCT w.id) AS waitingTeamIds
ORDER BY totalWaitSecs DESC
