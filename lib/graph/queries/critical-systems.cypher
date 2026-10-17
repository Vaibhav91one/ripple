// Systems ranked by PageRank over DEPENDS_ON (algo.pageRank, FalkorDB 6.0.2: https://docs.falkordb.com/algorithms/pagerank.html).
// An edge a -> b means "a depends on b", so rank flows to what others rely on: the systems that hurt most when changed.
// The algorithm cannot filter edges, so ended DEPENDS_ON (valid_to set) still count. `links` is a live-edge degree: it breaks ties in score
// (a graph with few dependency edges has many) and then id. algo.betweenness is not used: it is 0 for every node on a graph this shallow.
CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score
OPTIONAL MATCH (node)-[r]-(o) WHERE r.valid_to IS NULL AND NOT o:Artifact AND NOT o:Person AND NOT o:Decision
WITH node, score, count(r) AS links
RETURN node.id AS systemId, node.name AS name, score, links
ORDER BY round(score * 10000) DESC, links DESC, systemId
LIMIT $limit
