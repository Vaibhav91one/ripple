// One node of any kind by id and graph label (the label is a parameter test, so one query serves every kind).
MATCH (n {id: $id})
WHERE $label IN labels(n)
RETURN properties(n) AS props
