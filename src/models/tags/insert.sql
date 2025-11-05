INSERT INTO tags (tag)
VALUES ($1)
ON CONFLICT (tag) DO NOTHING
RETURNING id, tag, "timestamp";


