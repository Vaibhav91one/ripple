// A decision with the systems it sunsets, its effective date and the evidence of the announcement.
MATCH (d:Decision {id: $id})
OPTIONAL MATCH (d)-[sn:SUNSETS]->(s:System) WHERE sn.valid_to IS NULL
RETURN d.id AS id, d.title AS title, d.decidedAt AS decidedAt,
  collect(DISTINCT {id: s.id, name: s.name}) AS systems,
  head(collect(sn.on)) AS effectiveAt, head(collect(sn.src)) AS src, head(collect(sn.quote)) AS quote
