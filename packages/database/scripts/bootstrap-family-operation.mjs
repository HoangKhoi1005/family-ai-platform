export async function bootstrapFamily(client, { userId, familyId, name }) {
  await client.query('BEGIN');
  try {
    const user = await client.query(
      'SELECT id FROM users WHERE id = $1 AND email_verified = true',
      [userId],
    );
    if (user.rowCount !== 1) throw new Error('verified user was not found');

    const existing = await client.query('SELECT 1 FROM family_spaces WHERE id = $1', [familyId]);
    if (existing.rowCount) throw new Error('family id already exists');

    await client.query('INSERT INTO family_spaces(id, name) VALUES ($1, $2)', [
      familyId,
      name.trim(),
    ]);
    const membership = await client.query(
      `INSERT INTO family_memberships(family_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active') RETURNING id`,
      [familyId, userId],
    );
    await client.query(
      `INSERT INTO audit_entries(family_id, actor_id, action, target_type, target_id, change_summary)
       VALUES ($1, $2, 'family.bootstrap', 'family', $1, $3)`,
      [familyId, userId, `membership_id=${membership.rows[0].id}`],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
