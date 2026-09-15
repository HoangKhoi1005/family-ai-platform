# Encrypted PostgreSQL backups

The backup job writes the temporary PostgreSQL dump to an in-memory `/work` mount, encrypts it with the offline `age` recipient, and uploads only the `.age` object. Configure an R2 lifecycle rule that deletes objects under `postgres/` after 30 days. Keep the age identity offline and mount it read-only only during a restore drill.

Restore drills create a new database whose name ends in `_restore_drill`. They refuse the live database name and an existing target. After the owner verifies the drill evidence, the restore database can be removed in a separate, explicit maintenance action.
