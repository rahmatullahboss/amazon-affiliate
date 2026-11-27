import { env } from "cloudflare:workers";

export const publicationTestEnv = env as typeof env & {
  PUBLICATION_SNAPSHOTS: R2Bucket;
  TEST_PUBLICATION_MIGRATIONS: { name: string; queries: string[] }[];
};

// Only the explicitly enrolled publication tests install the held schema.
// The ordinary migration and test paths never install publication triggers.
export async function installPublicationTestSchema() {
  for (const migration of publicationTestEnv.TEST_PUBLICATION_MIGRATIONS) {
    for (const query of migration.queries) await env.DB.prepare(query).run();
  }
}
