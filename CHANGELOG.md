# Changelog

## 0.4.0 (2026-01-06)

- Reasoning effort picker now only offers valid levels for the selected model, plus a “use model default” option (unset `reasoningEffort`).
- Bulk “inherit” now clears `reasoningEffort` so it isn’t written to droid YAML.
- BYOK models are loaded from `~/.factory/settings.json` (`customModels`) and saved using `model: custom:<id>`.
- Added handled warning if model capability info can’t be loaded from `droid exec --help`.
