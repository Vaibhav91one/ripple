// Legal dashboard rows: contracts with their customer, clauses with the quote that sources them, the team. Param: $team.
MATCH (c:Contract)
OPTIONAL MATCH (c)-[:PARTY_TO]->(cu:Customer)
RETURN 'contracts' AS kind, collect({id: c.id, name: c.name, endsAt: c.endsAt, customerId: cu.id, noticeDays: c.noticeDays,
  value: c.value, approvalState: c.approvalState}) AS rows
UNION ALL
MATCH (c:Contract)-[h:HAS_CLAUSE]->(k:Clause)
RETURN 'clauses' AS kind, collect({id: k.id, contractId: c.id, number: k.number, title: k.title, text: k.text, risk: k.risk,
  dueAt: k.dueAt, src: {artifactId: h.src, quote: h.quote}, v1Related: coalesce(k.v1Related, false)}) AS rows
UNION ALL
MATCH (p:Person {teamId: $team})
RETURN 'people' AS kind, collect({id: p.id, name: p.name, title: p.title, email: p.email, teamId: p.teamId, active: p.active}) AS rows
