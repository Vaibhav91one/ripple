// Draft -> confirmed. Matches nothing (returns no row) if the change is not a draft.
MATCH (c:Change {id: $id}) WHERE c.status = 'draft'
SET c.status = 'confirmed', c.confirmed_at = $now
RETURN c.id AS id
