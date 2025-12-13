# Droid Model Tuner (JS)

A TUI (Terminal User Interface) tool for managing [Factory](https://factory.ai) droid/subagent model configurations. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs).

## Features

- View all your Factory droids and their current model assignments
- Change models for individual droids or all at once
- Supports all official Factory models + your custom BYOK models
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
| `i` | Set ALL droids to "inherit" |
| `s` | Save changes |
| `r` | Reload from disk |
| `q` | Quit |

## How It Works

The tool reads droid configurations from:
- Personal droids: `~/.factory/droids/*.md`

It also reads your BYOK custom models from `~/.factory/config.json` to include them in the model picker.

## License

MIT
