import crypto from 'node:crypto';
import { openDb } from './db.js';
import {
  DEFAULT_AI_SETTINGS,
  ensureDeepSeekModelId,
  ensureFreeModelId,
} from './openrouter.js';

const SETTING_ROW_KEY = 'ai_config_v1';
let tableEnsured = false;

function deriveEncryptionKey(secretOverride) {
  const rawSecret =
    secretOverride ||
    process.env.APP_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    'gmaps-leadgen-fallback-key';
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

export function encryptSecret(plainText, secretOverride) {
  const clean = String(plainText || '').trim();
  if (!clean) return '';

  const key = deriveEncryptionKey(secretOverride);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload, secretOverride) {
  const raw = String(payload || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('v1:')) return '';

  const parts = raw.split(':');
  if (parts.length !== 4) return '';

  try {
    const key = deriveEncryptionKey(secretOverride);
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ciphertext = Buffer.from(parts[3], 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function maskApiKey(key) {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return `${clean.slice(0, 2)}***`;
  return `${clean.slice(0, 5)}...${clean.slice(-4)}`;
}

async function ensureAppSettingTable(sql) {
  if (tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS "AppSetting" (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  tableEnsured = true;
}

export function formatPublicAiSettings(record = {}, updatedAt = null) {
  const deepseekKey = String(record.deepseekApiKey || '').trim();
  const openrouterKey = String(record.openrouterApiKey || '').trim();

  return {
    primaryProvider: record.primaryProvider === 'openrouter' ? 'openrouter' : 'deepseek',
    autoFallback:
      typeof record.autoFallback === 'boolean'
        ? record.autoFallback
        : DEFAULT_AI_SETTINGS.autoFallback,
    deepseekModel: ensureDeepSeekModelId(record.deepseekModel),
    openrouterModel: ensureFreeModelId(record.openrouterModel),
    agencyName: String(record.agencyName ?? DEFAULT_AI_SETTINGS.agencyName).trim() || DEFAULT_AI_SETTINGS.agencyName,
    serviceFocus: String(record.serviceFocus ?? DEFAULT_AI_SETTINGS.serviceFocus).trim() || DEFAULT_AI_SETTINGS.serviceFocus,
    pitchTone: ['casual', 'consultative', 'formal'].includes(record.pitchTone)
      ? record.pitchTone
      : 'casual',
    cloudDeepseekReady: Boolean(deepseekKey),
    cloudDeepseekMask: maskApiKey(deepseekKey),
    cloudOpenrouterReady: Boolean(openrouterKey),
    cloudOpenrouterMask: maskApiKey(openrouterKey),
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
}

export async function getDecryptedAiSettingsFromDb({ sqlImpl, secretOverride } = {}) {
  const sql = sqlImpl || (await openDb());
  await ensureAppSettingTable(sql);

  const rows = await sql`
    SELECT value, "updatedAt"
    FROM "AppSetting"
    WHERE key = ${SETTING_ROW_KEY}
    LIMIT 1
  `;

  if (!rows || rows.length === 0) {
    return {
      ...DEFAULT_AI_SETTINGS,
      deepseekApiKey: '',
      openrouterApiKey: '',
      updatedAt: null,
    };
  }

  const rawVal =
    typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value || {};

  const deepseekApiKey = decryptSecret(rawVal.deepseekApiKeyEnc, secretOverride);
  const openrouterApiKey = decryptSecret(rawVal.openrouterApiKeyEnc, secretOverride);

  return {
    primaryProvider: rawVal.primaryProvider === 'openrouter' ? 'openrouter' : 'deepseek',
    autoFallback:
      typeof rawVal.autoFallback === 'boolean'
        ? rawVal.autoFallback
        : DEFAULT_AI_SETTINGS.autoFallback,
    deepseekApiKey,
    deepseekModel: ensureDeepSeekModelId(rawVal.deepseekModel),
    openrouterApiKey,
    openrouterModel: ensureFreeModelId(rawVal.openrouterModel),
    agencyName: String(rawVal.agencyName ?? DEFAULT_AI_SETTINGS.agencyName),
    serviceFocus: String(rawVal.serviceFocus ?? DEFAULT_AI_SETTINGS.serviceFocus),
    pitchTone: ['casual', 'consultative', 'formal'].includes(rawVal.pitchTone)
      ? rawVal.pitchTone
      : 'casual',
    updatedAt: rows[0].updatedAt || null,
  };
}

export async function getPublicAiSettingsFromDb(options = {}) {
  try {
    const decrypted = await getDecryptedAiSettingsFromDb(options);
    return formatPublicAiSettings(decrypted, decrypted.updatedAt);
  } catch (err) {
    console.error('Failed to read AI settings from Neon DB:', { message: err?.message });
    return null;
  }
}

export async function saveAiSettingsToDb(input = {}, { sqlImpl, secretOverride } = {}) {
  const sql = sqlImpl || (await openDb());
  const existing = await getDecryptedAiSettingsFromDb({ sqlImpl: sql, secretOverride });

  const incomingDeepseek = String(input.deepseekApiKey || '').trim();
  const incomingOpenrouter = String(input.openrouterApiKey || '').trim();

  const nextDeepseekKey = input.clearDeepseekKey
    ? ''
    : incomingDeepseek || existing.deepseekApiKey || '';

  const nextOpenrouterKey = input.clearOpenrouterKey
    ? ''
    : incomingOpenrouter || existing.openrouterApiKey || '';

  const storedPayload = {
    primaryProvider: input.primaryProvider === 'openrouter' ? 'openrouter' : 'deepseek',
    autoFallback:
      typeof input.autoFallback === 'boolean' ? input.autoFallback : existing.autoFallback,
    deepseekApiKeyEnc: encryptSecret(nextDeepseekKey, secretOverride),
    deepseekModel: ensureDeepSeekModelId(input.deepseekModel || existing.deepseekModel),
    openrouterApiKeyEnc: encryptSecret(nextOpenrouterKey, secretOverride),
    openrouterModel: ensureFreeModelId(input.openrouterModel || existing.openrouterModel),
    agencyName:
      String(input.agencyName ?? existing.agencyName ?? DEFAULT_AI_SETTINGS.agencyName).trim() ||
      DEFAULT_AI_SETTINGS.agencyName,
    serviceFocus:
      String(
        input.serviceFocus ?? existing.serviceFocus ?? DEFAULT_AI_SETTINGS.serviceFocus
      ).trim() || DEFAULT_AI_SETTINGS.serviceFocus,
    pitchTone: ['casual', 'consultative', 'formal'].includes(input.pitchTone)
      ? input.pitchTone
      : existing.pitchTone || 'casual',
  };

  const payloadJson = JSON.stringify(storedPayload);
  const rows = await sql`
    INSERT INTO "AppSetting" (key, value, "updatedAt")
    VALUES (${SETTING_ROW_KEY}, ${payloadJson}::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "updatedAt"
  `;

  const updatedAt = rows?.[0]?.updatedAt || new Date().toISOString();

  return formatPublicAiSettings(
    {
      ...storedPayload,
      deepseekApiKey: nextDeepseekKey,
      openrouterApiKey: nextOpenrouterKey,
    },
    updatedAt
  );
}
