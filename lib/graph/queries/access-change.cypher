// The change an access request is for: its title, the date it takes effect (the deadline) and the sentence that says so.
MATCH (d:Decision {id: $id})
OPTIONAL MATCH (d)-[sn:SUNSETS]->(:System) WHERE sn.valid_to IS NULL
RETURN d.id AS id, d.title AS title, sn.on AS effectiveAt, sn.src AS src, sn.quote AS quote
