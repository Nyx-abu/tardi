import { Entry, findCredentials } from '@napi-rs/keyring';
import * as dotenv from 'dotenv';

// Load .env automatically
dotenv.config();

const SERVICE_NAME = 'tardi-cli';

// ─── Keychain CRUD ──────────────────────────────────────────────────────────

export async function setProviderKey(provider: string, key: string): Promise<void> {
  const e = new Entry(SERVICE_NAME, provider.toLowerCase());
  e.setPassword(key);
}

export async function getProviderKey(provider: string): Promise<string | null> {
  const e = new Entry(SERVICE_NAME, provider.toLowerCase());
  try {
    return e.getPassword() || null;
  } catch (err) {
    return null;
  }
}

export async function deleteProviderKey(provider: string): Promise<boolean> {
  const e = new Entry(SERVICE_NAME, provider.toLowerCase());
  try {
    e.deletePassword();
    return true;
  } catch (err) {
    return false;
  }
}

export async function wipeAllKeys(): Promise<number> {
  try {
    const credentials = findCredentials(SERVICE_NAME);
    for (const cred of credentials) {
      const e = new Entry(SERVICE_NAME, cred.account);
      try { e.deletePassword(); } catch(err) {}
    }
    return credentials.length;
  } catch (err) {
    return 0;
  }
}

export async function listStoredProviders(): Promise<string[]> {
  try {
    const credentials = findCredentials(SERVICE_NAME);
    return credentials.map(c => c.account);
  } catch(err) {
    return [];
  }
}

// ─── Env-based key lookup ───────────────────────────────────────────────────

const ENV_MAP: Record<string, string[]> = {
  'google':    ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  'openai':    ['OPENAI_API_KEY'],
  'anthropic': ['ANTHROPIC_API_KEY'],
};

export async function getEnvironmentKey(provider: string): Promise<string | undefined> {
  const envVars = ENV_MAP[provider.toLowerCase()] || [];
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      return process.env[envVar];
    }
  }
  return undefined;
}

export async function resolveApiKey(provider: string): Promise<string | undefined> {
  if (provider === 'local') return 'dummy';
  
  // 1. Check env vars first (CI-friendly)
  const envKey = await getEnvironmentKey(provider);
  if (envKey) return envKey;
  
  // 2. Check OS Keychain
  const keychainKey = await getProviderKey(provider);
  if (keychainKey) {
    // Populate env so the AI SDK picks it up automatically
    const primaryEnvVar = ENV_MAP[provider.toLowerCase()]?.[0];
    if (primaryEnvVar) process.env[primaryEnvVar] = keychainKey;
    return keychainKey;
  }
  
  return undefined;
}

// ─── Model Discovery ────────────────────────────────────────────────────────

export interface DiscoveredModel {
  id: string;
  displayName: string;
  description?: string;
}

export async function fetchAvailableModels(provider: string, apiKey: string): Promise<DiscoveredModel[]> {
  if (provider === 'google') {
    return fetchGoogleModels(apiKey);
  }
  if (provider === 'openai') {
    return fetchOpenAIModels(apiKey);
  }
  // Anthropic doesn't have a list-models endpoint; return known models
  if (provider === 'anthropic') {
    return [
      { id: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus' },
    ];
  }
  return [];
}

async function fetchGoogleModels(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google API returned ${res.status}: ${body}`);
    }
    const data = await res.json() as { models?: Array<{ name: string; displayName: string; description?: string; supportedGenerationMethods?: string[] }> };
    if (!data.models) return [];
    
    // Only show models that support generateContent (chat/text gen)
    return data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
      }));
  } catch (e: any) {
    throw new Error(`Failed to fetch Google models: ${e.message}`);
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API returned ${res.status}: ${body}`);
    }
    const data = await res.json() as { data?: Array<{ id: string }> };
    if (!data.data) return [];
    
    // Filter to chat-capable models
    const chatModels = data.data
      .filter(m => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('o4'))
      .sort((a, b) => a.id.localeCompare(b.id));
    
    return chatModels.map(m => ({
      id: m.id,
      displayName: m.id,
    }));
  } catch (e: any) {
    throw new Error(`Failed to fetch OpenAI models: ${e.message}`);
  }
}
