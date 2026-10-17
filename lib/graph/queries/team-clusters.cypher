// Teams grouped by what they share: weakly connected components (algo.WCC, https://docs.falkordb.com/algorithms/wcc.html) over
// Team, System, Contract and Deal nodes joined by OWNS, CARES_ABOUT, MANAGED_BY (contract -> team), GUARANTEES, OWNED_BY (deal -> team)
// and PROMISED. Legal (manages contracts that GUARANTEES a system) and Sales (owns deals that PROMISED it) land together.
// WCC takes no edge filter, so ended edges (valid_to set) still link. Only the counts of contracts and deals are returned:
// their ids are restricted. Teams that share nothing are left out.
CALL algo.WCC({nodeLabels: ['Team', 'System', 'Contract', 'Deal'], relationshipTypes: ['OWNS', 'CARES_ABOUT', 'MANAGED_BY', 'GUARANTEES', 'OWNED_BY', 'PROMISED']}) YIELD node, componentId
WITH componentId, collect(node) AS ns
WITH componentId, [n IN ns WHERE n:Team | n.id] AS teamIds, [n IN ns WHERE n:System | n.id] AS systemIds,
  size([n IN ns WHERE n:Contract]) AS contracts, size([n IN ns WHERE n:Deal]) AS deals
WHERE size(teamIds) > 1
RETURN teamIds, systemIds, contracts, deals
ORDER BY size(teamIds) DESC, teamIds[0]
LIMIT $limit
