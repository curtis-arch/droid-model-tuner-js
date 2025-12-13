import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

export const VERSION = '0.3.0';

export const FACTORY_MODELS = [
  'inherit',
  'claude-opus-4-5-20251101',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805',
  'claude-haiku-4-5-20251001',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex',
  'gpt-5.1',
  'gemini-3-pro-preview',
  'glm-4.6',
];

const PERSONAL_DROIDS_DIR = path.join(os.homedir(), '.factory', 'droids');
const FACTORY_CONFIG_PATH = path.join(os.homedir(), '.factory', 'config.json');

export function getAvailableModels() {
  const factory = [...FACTORY_MODELS];
  const byok = [];

  if (fs.existsSync(FACTORY_CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(FACTORY_CONFIG_PATH, 'utf8'));
      const customModels = config.custom_models || [];
      for (const cm of customModels) {
        if (cm.model) {
          byok.push(cm.model);
        }
      }
    } catch (e) {
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
            location: 'personal',
          });
        } catch (e) {
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
  const newContent = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(droid.path, newContent);
  droid.originalModel = droid.model;
}
