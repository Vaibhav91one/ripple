// ⌘K search: changes that reach a matching customer (Decision -SUNSETS-> System <-USES- Customer), so "northwind" also
// finds the v1 sunset. $q is lower-case. Row: id, title, customer. Customer names are shared topology, never restricted.
MATCH (d:Decision)-[:SUNSETS]->(:System)<-[:USES]-(c:Customer)
WHERE toLower(coalesce(c.name, '')) CONTAINS $q
RETURN DISTINCT d.id AS id, coalesce(d.title, d.id) AS title, d.status AS status, min(c.name) AS customer
LIMIT 5
