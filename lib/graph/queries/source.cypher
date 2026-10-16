// One artifact (doc, ticket, message or PR) by id.
MATCH (a:Artifact {id: $id})
RETURN a.id AS id, a.kind AS kind, a.docKind AS docKind, a.status AS status, a.title AS title,
  a.text AS text, a.ts AS ts, a.uri AS uri, a.author AS authorId
