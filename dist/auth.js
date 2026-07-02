"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setProviderKey = setProviderKey;
exports.getProviderKey = getProviderKey;
exports.deleteProviderKey = deleteProviderKey;
exports.wipeAllKeys = wipeAllKeys;
exports.listStoredProviders = listStoredProviders;
exports.getEnvironmentKey = getEnvironmentKey;
exports.resolveApiKey = resolveApiKey;
exports.fetchAvailableModels = fetchAvailableModels;
const keyring_1 = require("@napi-rs/keyring");
const dotenv = __importStar(require("dotenv"));
// Load .env automatically
dotenv.config();
const SERVICE_NAME = 'tardi-cli';
// ─── Keychain CRUD ──────────────────────────────────────────────────────────
async function setProviderKey(provider, key) {
    const e = new keyring_1.Entry(SERVICE_NAME, provider.toLowerCase());
    e.setPassword(key);
}
async function getProviderKey(provider) {
    const e = new keyring_1.Entry(SERVICE_NAME, provider.toLowerCase());
    try {
        return e.getPassword() || null;
    }
    catch (err) {
        return null;
    }
}
async function deleteProviderKey(provider) {
    const e = new keyring_1.Entry(SERVICE_NAME, provider.toLowerCase());
    try {
        e.deletePassword();
        return true;
    }
    catch (err) {
        return false;
    }
}
async function wipeAllKeys() {
    try {
        const credentials = (0, keyring_1.findCredentials)(SERVICE_NAME);
        for (const cred of credentials) {
            const e = new keyring_1.Entry(SERVICE_NAME, cred.account);
            try {
                e.deletePassword();
            }
            catch (err) { }
        }
        return credentials.length;
    }
    catch (err) {
        return 0;
    }
}
async function listStoredProviders() {
    try {
        const credentials = (0, keyring_1.findCredentials)(SERVICE_NAME);
        return credentials.map(c => c.account);
    }
    catch (err) {
        return [];
    }
}
// ─── Env-based key lookup ───────────────────────────────────────────────────
const ENV_MAP = {
    'google': ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    'openai': ['OPENAI_API_KEY'],
    'anthropic': ['ANTHROPIC_API_KEY'],
};
async function getEnvironmentKey(provider) {
    const envVars = ENV_MAP[provider.toLowerCase()] || [];
    for (const envVar of envVars) {
        if (process.env[envVar]) {
            return process.env[envVar];
        }
    }
    return undefined;
}
async function resolveApiKey(provider) {
    if (provider === 'local')
        return 'dummy';
    // 1. Check env vars first (CI-friendly)
    const envKey = await getEnvironmentKey(provider);
    if (envKey)
        return envKey;
    // 2. Check OS Keychain
    const keychainKey = await getProviderKey(provider);
    if (keychainKey) {
        // Populate env so the AI SDK picks it up automatically
        const primaryEnvVar = ENV_MAP[provider.toLowerCase()]?.[0];
        if (primaryEnvVar)
            process.env[primaryEnvVar] = keychainKey;
        return keychainKey;
    }
    return undefined;
}
async function fetchAvailableModels(provider, apiKey) {
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
async function fetchGoogleModels(apiKey) {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Google API returned ${res.status}: ${body}`);
        }
        const data = await res.json();
        if (!data.models)
            return [];
        // Only show models that support generateContent (chat/text gen)
        return data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => ({
            id: m.name.replace('models/', ''),
            displayName: m.displayName,
            description: m.description,
        }));
    }
    catch (e) {
        throw new Error(`Failed to fetch Google models: ${e.message}`);
    }
}
async function fetchOpenAIModels(apiKey) {
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`OpenAI API returned ${res.status}: ${body}`);
        }
        const data = await res.json();
        if (!data.data)
            return [];
        // Filter to chat-capable models
        const chatModels = data.data
            .filter(m => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('o4'))
            .sort((a, b) => a.id.localeCompare(b.id));
        return chatModels.map(m => ({
            id: m.id,
            displayName: m.id,
        }));
    }
    catch (e) {
        throw new Error(`Failed to fetch OpenAI models: ${e.message}`);
    }
}
