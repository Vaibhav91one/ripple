// Text of artifacts by id, to build verbatim citation quotes.
MATCH (a:Artifact) WHERE a.id IN $ids
RETURN a.id AS id, a.text AS text
