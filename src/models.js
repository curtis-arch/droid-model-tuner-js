import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { execSync } from 'child_process';

// Read version from package.json
const pkgPath = new URL('../package.json', import.meta.url);
export const VERSION = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

// Fallback models if CLI parsing fails
const FALLBACK_MODELS = [
  'inherit',
  'claude-opus-4-5-20251101',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805',
  'claude-haiku-4-5-20251001',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex',
  'gpt-5.1',
  'gpt-5.2',
  'gemini-3-pro-preview',
  'glm-4.6',
];

const PERSONAL_DROIDS_DIR = path.join(os.homedir(), '.factory', 'droids');
const FACTORY_CONFIG_PATH = path.join(os.homedir(), '.factory', 'config.json');
const FACTORY_SETTINGS_PATH = path.join(os.homedir(), '.factory', 'settings.json');

// Fetch JSON from a URL using built-in http/https (no extra dependencies)
async function fetchJson(url, headers = {}) {
  const protocol = url.startsWith('https://') ? 'https' : 'http';
  const { default: transport } = await import(protocol);
  return new Promise((resolve, reject) => {
    const req = transport.get(url, { headers, timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Optionally syncs available models from a local proxy by fetching /v1/models.
 * Safe to call always — silently does nothing if no proxy is configured or reachable.
 * Proxy URL is detected from:
 *   1. settings.json { proxyUrl: "http://localhost:8317" }
 *   2. Auto-detected from base_url on existing custom_models in config.json
 */
export async function syncModelsFromProxy() {
  let proxyBase = null;

  // 1. Explicit opt-in via settings.json proxyUrl
  if (fs.existsSync(FACTORY_SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(fs.readFileSync(FACTORY_SETTINGS_PATH, 'utf8'));
      if (settings.proxyUrl) {
        proxyBase = settings.proxyUrl.replace(/\/v1\/?$/, '');
      }
      // 2. Auto-detect from existing customModels baseUrl (settings.json uses camelCase)
      if (!proxyBase) {
        const firstWithUrl = (settings.customModels || []).find((m) => m?.baseUrl);
        if (firstWithUrl) {
          proxyBase = firstWithUrl.baseUrl.replace(/\/v1\/?$/, '');
        }
      }
    } catch {}
  }

  // 3. Auto-detect from config.json custom_models base_url (snake_case)
  if (!proxyBase && fs.existsSync(FACTORY_CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(FACTORY_CONFIG_PATH, 'utf8'));
      const models = config.customModels || config.custom_models || [];
      const firstWithUrl = models.find((m) => m?.base_url);
      if (firstWithUrl) {
        proxyBase = firstWithUrl.base_url.replace(/\/v1\/?$/, '');
      }
    } catch {}
  }

  if (!proxyBase) return false;

  // Fetch model list from proxy
  let modelIds;
  try {
    const data = await fetchJson(`${proxyBase}/v1/models`, {
      Authorization: 'Bearer dummy-not-used',
    });
    modelIds = (data.data || []).map((m) => m.id).filter(Boolean);
  } catch {
    return false; // Proxy unreachable or not an OpenAI-compat endpoint
  }

  if (!modelIds.length) return false;

  // Load settings.json — we write back to customModels there since it's the primary source
  let settings = {};
  if (fs.existsSync(FACTORY_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(FACTORY_SETTINGS_PATH, 'utf8'));
    } catch {}
  }

  // Index existing entries by model ID to preserve their metadata
  const existing = {};
  for (const cm of (settings.customModels || [])) {
    if (cm?.model) existing[cm.model] = cm;
  }

  // Build updated list: preserve existing entries, append new ones
  const updated = [...modelIds].sort().map((modelId, index) => {
    if (existing[modelId]) return existing[modelId];
    const isAnthropic = modelId.startsWith('claude-');
    return {
      model: modelId,
      id: `custom:${modelId}-${index}`,
      index,
      baseUrl: isAnthropic ? proxyBase : `${proxyBase}/v1`,
      apiKey: 'dummy-not-used',
      displayName: modelId,
      noImageSupport: false,
      provider: isAnthropic ? 'anthropic' : 'openai',
    };
  });

  // Re-index so index fields stay consistent
  updated.forEach((m, i) => { m.index = i; });

  fs.mkdirSync(path.dirname(FACTORY_SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(
    FACTORY_SETTINGS_PATH,
    JSON.stringify({ ...settings, customModels: updated }, null, 2)
  );

  return true;
}

// Cache for dynamic models and reasoning info
let cachedModels = null;
let cachedReasoningInfo = {};
let cachedDroidHelpOk = null;
let cachedDroidHelpError = null;

function toModelIdForLookup(modelId) {
  if (!modelId) return modelId;
  return modelId.startsWith('custom:') ? modelId.slice('custom:'.length) : modelId;
}

function parseModelsFromDroidHelp() {
  try {
    const output = execSync('droid exec --help 2>&1', {
      encoding: 'utf8',
      timeout: 5000,
    });

    const models = ['inherit'];
    const displayToId = {}; // Map display name -> model ID
    const reasoningInfo = {};
    const lines = output.split('\n');
    let inModelsSection = false;
    let inModelDetails = false;

    for (const line of lines) {
      // Parse Available Models section
      if (line.trim() === 'Available Models:') {
        inModelsSection = true;
        inModelDetails = false;
        continue;
      }
      if (inModelsSection) {
        if (line.trim() === '' || line.trim().startsWith('Custom Models:')) {
          inModelsSection = false;
          continue;
        }
        // Parse: "  gpt-5.1-codex                OpenAI GPT-5.1-Codex"
        const match = line.match(/^\s{2}(\S+)\s+(.+)$/);
        if (match && match[1]) {
          models.push(match[1]);
          if (match[2]) {
            // Strip "(default)" suffix for matching
            const displayName = match[2].trim().replace(/\s*\(default\)\s*$/i, '').toLowerCase();
            displayToId[displayName] = match[1];
          }
        }
      }

      // Parse Model details section for reasoning effort
      if (line.trim() === 'Model details:') {
        inModelDetails = true;
        continue;
      }
      if (inModelDetails) {
        if (line.trim() === '' || !line.startsWith('  -')) {
          if (line.trim() !== '' && !line.startsWith('  ')) {
            inModelDetails = false;
          }
          continue;
        }
        // Parse: "  - OpenAI GPT-5.1: supports reasoning: Yes; supported: [low, medium, high]; default: medium"
        const nameMatch = line.match(/^\s+-\s+([^:]+):/);
        const detailMatch = line.match(/supported:\s*\[([^\]]*)\];\s*default:\s*(\w+)/);
        if (nameMatch && detailMatch) {
          const displayName = nameMatch[1].trim().toLowerCase();
          const supported = detailMatch[1].split(',').map(s => s.trim()).filter(Boolean);
          const defaultLevel = detailMatch[2];
          // Look up model ID from display name
          const modelId = displayToId[displayName];
          if (modelId) {
            reasoningInfo[modelId] = { supported, default: defaultLevel };
          }
        }
      }
    }

    cachedDroidHelpOk = true;
    cachedDroidHelpError = null;
    cachedReasoningInfo = reasoningInfo;

    return models.length > 1 ? models : null;
  } catch (e) {
    cachedDroidHelpOk = false;
    cachedDroidHelpError = e?.message || 'Failed to load `droid exec --help`.';
    return null;
  }
}

export function getDroidHelpStatus() {
  if (!cachedModels) {
    cachedModels = parseModelsFromDroidHelp() || FALLBACK_MODELS;
  }
  return { ok: cachedDroidHelpOk, error: cachedDroidHelpError };
}

export function getReasoningLevels(modelId) {
  if (!cachedModels) {
    cachedModels = parseModelsFromDroidHelp() || FALLBACK_MODELS;
  }
  const lookupId = toModelIdForLookup(modelId);
  return cachedReasoningInfo[lookupId] || null;
}

export function getAvailableModels() {
  // Try to get models dynamically, fall back to hardcoded list
  if (!cachedModels) {
    cachedModels = parseModelsFromDroidHelp() || FALLBACK_MODELS;
  }
  const factory = [...cachedModels];
  const byok = [];

  // Preferred: ~/.factory/settings.json (customModels)
  if (fs.existsSync(FACTORY_SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(fs.readFileSync(FACTORY_SETTINGS_PATH, 'utf8'));
      const customModels = settings.customModels || [];
      for (const cm of customModels) {
        if (cm?.model) byok.push(cm.model);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Legacy: ~/.factory/config.json (custom_models or customModels)
  if (byok.length === 0 && fs.existsSync(FACTORY_CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(FACTORY_CONFIG_PATH, 'utf8'));
      const customModels = config.customModels || config.custom_models || [];
      for (const cm of customModels) {
        if (cm?.model) byok.push(cm.model);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { factory, byok };
}

export function discoverDroids() {
  const droids = [];

  // Personal droids
  if (fs.existsSync(PERSONAL_DROIDS_DIR)) {
    const files = fs.readdirSync(PERSONAL_DROIDS_DIR);
    for (const file of files) {
      if (file.endsWith('.md') && !file.startsWith('.')) {
        try {
          const filePath = path.join(PERSONAL_DROIDS_DIR, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const { data } = matter(content);
          droids.push({
            name: path.basename(file, '.md'),
            path: filePath,
            model: data.model || 'inherit',
            originalModel: data.model || 'inherit',
            reasoningEffort: data.reasoningEffort,
            originalReasoningEffort: data.reasoningEffort,
            location: 'personal',
          });
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  }

  // Sort by name
  return droids.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveDroid(droid) {
  const content = fs.readFileSync(droid.path, 'utf8');
  const parsed = matter(content);
  parsed.data.model = droid.model;
  if (droid.reasoningEffort) {
    parsed.data.reasoningEffort = droid.reasoningEffort;
  } else {
    delete parsed.data.reasoningEffort;
  }
  const newContent = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(droid.path, newContent);
  droid.originalModel = droid.model;
  droid.originalReasoningEffort = droid.reasoningEffort;
}
