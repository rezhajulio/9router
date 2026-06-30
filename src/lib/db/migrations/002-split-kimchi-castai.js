// Split the local API-key "Cast AI" provider out from upstream's OAuth "kimchi".
//
// Background: this fork shipped a "kimchi" provider that talks to Cast AI via an
// API key. Upstream later added its own "kimchi" provider that uses OAuth. To
// stop them colliding, the fork's provider is renamed to "castai". This migration
// moves any already-saved data from "kimchi" → "castai".
//
// Safety: only runs when an API-key "kimchi" connection exists (i.e. this DB
// belongs to a fork user). Pure-upstream users have only OAuth "kimchi"
// connections, so the gate is false and the migration is a no-op — their OAuth
// "kimchi" data is left untouched.
const FROM = "kimchi";
const TO = "castai";

export default {
  version: 2,
  name: "split-kimchi-castai",
  up(db) {
    const apikeyKimchi =
      db.get(
        `SELECT COUNT(*) AS c FROM providerConnections WHERE provider = ? AND authType = 'apikey'`,
        [FROM]
      )?.c ?? 0;
    if (apikeyKimchi === 0) return; // not a fork DB → nothing to migrate

    const now = new Date().toISOString();

    // 1. Saved connections (the API keys) — only the API-key ones.
    db.run(
      `UPDATE providerConnections SET provider = ?, updatedAt = ? WHERE provider = ? AND authType = 'apikey'`,
      [TO, now, FROM]
    );

    // 2. Usage history (provider is a plain column).
    db.run(`UPDATE usageHistory SET provider = ? WHERE provider = ?`, [TO, FROM]);

    // 3. Request details: provider column + the provider field inside the JSON
    //    blob (precise token replace so request/response previews are untouched).
    db.run(
      `UPDATE requestDetails SET provider = ?, data = REPLACE(data, '"provider":"${FROM}"', '"provider":"${TO}"') WHERE provider = ?`,
      [TO, FROM]
    );

    // 4. Daily aggregates: provider appears as object keys and as composite
    //    "model|provider" / "...|provider" keys inside the JSON.
    db.run(
      `UPDATE usageDaily SET data = REPLACE(REPLACE(data, '"${FROM}"', '"${TO}"'), '|${FROM}"', '|${TO}"') WHERE data LIKE '%${FROM}%'`
    );

    // 5. Combos reference models as "provider/model".
    db.run(
      `UPDATE combos SET models = REPLACE(models, '"${FROM}/', '"${TO}/') WHERE models LIKE '%"${FROM}/%'`
    );

    // 6. Custom models: keyed "provider|id|kind" with providerAlias in the value.
    db.run(
      `UPDATE kv SET key = REPLACE(key, '${FROM}|', '${TO}|'), value = REPLACE(value, '"providerAlias":"${FROM}"', '"providerAlias":"${TO}"') WHERE scope = 'customModels' AND key LIKE '${FROM}|%'`
    );

    // 7. Disabled-models + pricing are keyed by provider id.
    db.run(`UPDATE kv SET key = ? WHERE scope = 'disabledModels' AND key = ?`, [TO, FROM]);
    db.run(`UPDATE kv SET key = ? WHERE scope = 'pricing' AND key = ?`, [TO, FROM]);
  },
};
