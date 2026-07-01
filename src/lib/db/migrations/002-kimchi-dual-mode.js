// Kimchi dual-mode upgrade: Ensure all existing "kimchi" connections remain valid
//
// Background: Upstream Cast AI's OAuth provider now accepts BOTH:
//   1. OAuth tokens from https://app.kimchi.dev
//   2. Legacy Cast AI API keys from https://cast.ai
//
// This migration is a no-op - it exists solely to:
//   - Prevent accidentally renaming "kimchi" to "castai" in future migrations
//   - Document that both auth modes work on the same endpoint
//   - Serve as version marker so the schema system knows v2 is applied
export default {
  version: 2,
  name: "kimchi-dual-mode",
  up(db) {
    // Verify existing kimchi API-key connections are still present
    const kimchiConnections = db.get(
      `SELECT COUNT(*) AS c FROM providerConnections WHERE provider = 'kimchi' AND authType = 'apikey'`,
      []
    )?.c ?? 0;
    
    if (kimchiConnections > 0) {
      console.log(`[DB][migrate] #2 kimchi-dual-mode: ${kimchiConnections} legacy API-key kimchi connections preserved ✓`);
    } else {
      console.log(`[DB][migrate] #2 kimchi-dual-mode: No legacy API-key connections found (fresh OAuth setup) ✓`);
    }
    
    // Migration is intentionally a no-op since API keys already work on upstream endpoints
  },
};
