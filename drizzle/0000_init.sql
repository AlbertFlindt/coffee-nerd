-- Baseline: an empty database. The tables from docs/data-model.md §3 arrive in milestone M2.
-- SQLite rejects a migration without a statement, so this one runs a no-op.
SELECT 1;
