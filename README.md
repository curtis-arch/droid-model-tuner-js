# Droid Model Tuner (JS)

A TUI (Terminal User Interface) tool for managing [Factory](https://factory.ai) droid/subagent model configurations. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs).

## Features

- View all your Factory droids and their current model assignments
- Change models for individual droids or all at once
- Reasoning effort picker that only shows valid levels for the selected model (plus “use model default”)
- Supports official Factory models + your custom BYOK models
- Visual indicators for unsaved changes
- Vim-style navigation (j/k keys)

## Installation

### Quick Run (no install needed)

```bash
npx droid-model-tuner
```

### Install Globally

```bash
npm install -g droid-model-tuner
```

## Usage

```bash
droid-model-tuner
```

### Keybindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` | Edit selected droid's model |
| `a` | Set ALL droids to a model |
| `i` | Set ALL droids to "inherit" (clears reasoningEffort) |
| `s` | Save changes |
| `r` | Reload from disk |
| `q` | Quit |

## How It Works

The tool reads droid configurations from:
- Personal droids: `~/.factory/droids/*.md`

It also reads your BYOK custom models from `~/.factory/settings.json` (`customModels`) or `~/.factory/config.json` (`custom_models`) to include them in the model picker.

### Auto-sync custom models

On each run, the tool checks for an OpenAI-compatible proxy and automatically syncs the latest available models into your `~/.factory/config.json`. This keeps your model picker up to date without manual edits.

The proxy is detected automatically from the `base_url` on your existing custom models. You can also set it explicitly in `~/.factory/settings.json`:

```json
{
  "proxyUrl": "http://localhost:8317"
}
```

If no proxy is configured or reachable, this step is silently skipped.

## License

MIT
