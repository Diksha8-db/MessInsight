/**
 * MessInsight Database Seeding Script (Phase 0 Skeleton)
 * Full implementation in Phase 1.
 * Refuses execution in production environments.
 */

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY ERROR] Seeding is strictly forbidden in production.');
    process.exit(1);
  }

  console.log('[Seed] Database seed script placeholder initialized.');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}

export { seed };

