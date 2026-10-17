// What the decision means for one team ($team, $decision, $since). Each branch returns kind + rows.
// changes: recent edges that touch the team, its people, or things it owns/manages/handles (newest 80; the wrapper keeps those inside the decision's ripple)
MATCH (a)-[r]->(b)
WHERE r.valid_from > $since AND type(r) <> 'BETWEEN' AND NOT a:AgentFinding
  AND (a.id = $team OR b.id = $team OR a.teamId = $team OR b.teamId = $team OR a.ownerTeamId = $team
    OR (a)-[:MANAGED_BY]->(:Team {id: $team}) OR (a)-[:OWNED_BY]->(:Team {id: $team})
    OR (a)-[:HANDLED_BY]->(:Person {teamId: $team}) OR (:Team {id: $team})-[:OWNS]->(a))
WITH a, r, b ORDER BY r.valid_from DESC LIMIT 80
RETURN 'changes' AS kind, collect({from: a.id, to: b.id, type: type(r), validFrom: r.valid_from, validTo: r.valid_to,
  src: r.src, quote: r.quote}) AS rows
UNION ALL
// gap: is the team hit by what the decision sunsets, or does it own a goal the decision blocks, and did the team, or one of its people, take part or acknowledge?
MATCH (t:Team {id: $team})
OPTIONAL MATCH (d:Decision {id: $decision})-[:SUNSETS]->(s:System)
OPTIONAL MATCH (t)-[a:AFFECTED|OWNS|CARES_ABOUT]->(s)
OPTIONAL MATCH (t)-[i:INVOLVED_IN]->(d)
OPTIONAL MATCH (t)-[k:ACKED]->(d)
OPTIONAL MATCH (:Person {teamId: t.id})-[mk:ACKED]->(d)
OPTIONAL MATCH (gl:Goal)-[b:BLOCKED_BY]->(d) WHERE b.valid_to IS NULL AND ((t)-[:OWNS]->(gl) OR gl.ownerTeamId = t.id)
WITH count(a) > 0 OR count(b) > 0 AS affected, count(i) > 0 AS involved, count(k) > 0 OR count(mk) > 0 AS acked
RETURN 'gap' AS kind, [{affected: affected, involved: involved, acked: acked}] AS rows
UNION ALL
// facts: one sourced line per way the team is tied to the sunset (the wrapper keeps the first 3)
MATCH (t:Team {id: $team})-[r:OWNS|CARES_ABOUT]->(s:System) WHERE r.valid_to IS NULL AND r.src IS NOT NULL
WITH t, r, s LIMIT 1
RETURN 'facts' AS kind, collect({text: CASE type(r) WHEN 'OWNS' THEN 'Owns ' ELSE 'Cares about ' END + s.name, src: r.src, quote: r.quote}) AS rows
UNION ALL
MATCH (c:Contract)-[:MANAGED_BY]->(:Team {id: $team})
MATCH (c)-[r:GUARANTEES]->(s:System) WHERE r.valid_to IS NULL AND r.src IS NOT NULL
WITH c, r, s ORDER BY c.id LIMIT 1
RETURN 'facts' AS kind, collect({text: c.name + ' guarantees ' + s.name + ' past the sunset', src: r.src, quote: r.quote}) AS rows
UNION ALL
MATCH (d:Deal)-[:OWNED_BY]->(:Team {id: $team})
MATCH (d)-[r:PROMISED]->(s:System) WHERE r.valid_to IS NULL AND r.src IS NOT NULL AND d.stage <> 'closed_lost'
WITH d, r, s ORDER BY d.id LIMIT 1
RETURN 'facts' AS kind, collect({text: d.name + ' was promised ' + s.name + ' through 2027', src: r.src, quote: r.quote}) AS rows
UNION ALL
MATCH (a:Ticket {status: 'open'})-[r:ABOUT]->(s:System {id: 'api-v1'}) WHERE r.valid_to IS NULL AND r.src IS NOT NULL
MATCH (a)-[:HANDLED_BY]->(p:Person {teamId: $team})
WITH a, r, s ORDER BY a.id LIMIT 1
RETURN 'facts' AS kind, collect({text: 'Open ticket: ' + a.title, src: r.src, quote: r.quote}) AS rows
UNION ALL
MATCH (t:Team {id: $team})-[:OWNS]->(s:System)<-[r:SUNSETS]-(d:Decision {id: $decision}) WHERE r.valid_to IS NULL AND r.src IS NOT NULL
WITH d, r, s LIMIT 1
RETURN 'facts' AS kind, collect({text: d.title + ' (owns ' + s.name + ')', src: r.src, quote: r.quote}) AS rows
UNION ALL
MATCH (g:Goal)-[r:BLOCKED_BY]->(d:Decision {id: $decision}) WHERE $team = 'leadership' AND r.src IS NOT NULL
WITH g, r, d ORDER BY g.id LIMIT 1
RETURN 'facts' AS kind, collect({text: g.title + ' is blocked by ' + d.title, src: r.src, quote: r.quote}) AS rows
