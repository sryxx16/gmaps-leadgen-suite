import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSecret,
  decryptSecret,
  maskApiKey,
  saveAiSettingsToDb,
  getDecryptedAiSettingsFromDb,
  getPublicAiSettingsFromDb,
} from './aiSettingsStore.js';

test('encryptSecret and decryptSecret round-trip API keys with AES-256-GCM and reject wrong secrets', () => {
  const secret = 'team-shared-neon-secret';
  const rawKey = 'sk-9f8e7d6c5b4a3210fedcba';

  const cipher = encryptSecret(rawKey, secret);
  assert.ok(cipher.startsWith('v1:'));
  assert.ok(!cipher.includes(rawKey));

  assert.equal(decryptSecret(cipher, secret), rawKey);
  assert.equal(decryptSecret(cipher, 'wrong-secret'), '');
  assert.equal(maskApiKey(rawKey), 'sk-9f...dcba');
});

test('saveAiSettingsToDb persists encrypted keys and preserves untouched keys across updates', async () => {
  const fakeTable = new Map();

  const mockSql = async (strings, ...values) => {
    const query = strings.join(' ').trim();
    if (query.startsWith('CREATE TABLE')) {
      return [];
    }
    if (query.startsWith('SELECT value')) {
      const key = values[0];
      if (!fakeTable.has(key)) return [];
      return [fakeTable.get(key)];
    }
    if (query.startsWith('INSERT INTO "AppSetting"')) {
      const key = values[0];
      const valJson = values[1];
      const row = {
        value: JSON.parse(valJson),
        updatedAt: '2026-10-31T04:30:00.000Z',
      };
      fakeTable.set(key, row);
      return [{ updatedAt: row.updatedAt }];
    }
    return [];
  };

  const secret = 'unit-test-secret';

  // Friend A saves DeepSeek and OpenRouter keys
  const saved1 = await saveAiSettingsToDb(
    {
      primaryProvider: 'deepseek',
      deepseekApiKey: 'sk-deepseek-team-9988',
      openrouterApiKey: 'sk-or-v1-team-7766',
      agencyName: 'Nusantara Web Studio',
      pitchTone: 'consultative',
    },
    { sqlImpl: mockSql, secretOverride: secret }
  );

  assert.equal(saved1.cloudDeepseekReady, true);
  assert.equal(saved1.cloudDeepseekMask, 'sk-de...9988');
  assert.equal(saved1.cloudOpenrouterReady, true);
  assert.equal(saved1.agencyName, 'Nusantara Web Studio');

  // Friend B updates agencyName without re-entering API keys -> keys stay intact!
  const saved2 = await saveAiSettingsToDb(
    {
      primaryProvider: 'deepseek',
      deepseekApiKey: '',
      openrouterApiKey: '',
      agencyName: 'Studio Digital Bersama',
    },
    { sqlImpl: mockSql, secretOverride: secret }
  );

  assert.equal(saved2.cloudDeepseekReady, true);
  assert.equal(saved2.cloudOpenrouterReady, true);
  assert.equal(saved2.agencyName, 'Studio Digital Bersama');

  const decrypted = await getDecryptedAiSettingsFromDb({
    sqlImpl: mockSql,
    secretOverride: secret,
  });
  assert.equal(decrypted.deepseekApiKey, 'sk-deepseek-team-9988');
  assert.equal(decrypted.openrouterApiKey, 'sk-or-v1-team-7766');

  const pub = await getPublicAiSettingsFromDb({
    sqlImpl: mockSql,
    secretOverride: secret,
  });
  assert.equal(pub.deepseekApiKey, undefined);
  assert.equal(pub.cloudDeepseekReady, true);
});

