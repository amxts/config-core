# Changelog

## v0.1.2

[compare changes](https://github.com/amxts/config-core/compare/v0.1.1...v0.1.2)

### Summary

Built for `@amxts/core` 0.2.2: the package's prebuilt plugin is compiled with that core, so a project on 0.2.2 takes it as it is instead of compiling the module on its first build. The module's API does not change.

### ⬆️ Upgrade guide

`npx amxts upgrade` in the project takes it with the core.

### 📦 Dependencies

| Package | Range |
| --- | --- |
| `@amxts/core` | `^0.2.0`, prebuilt for 0.2.2 |

### ❤️ Contributors

- Ernest Manukyan ([@kukson777](https://github.com/kukson777))

## v0.1.1

[compare changes](https://github.com/amxts/config-core/compare/v0.1.0...v0.1.1)

### Summary

config-core for amxts 0.2.0. Its API is unchanged: a plugin that reads its configs needs nothing new.

### ⚠️ Breaking changes

None in config-core itself; it needs `@amxts/core` 0.2.

### ⬆️ Upgrade guide

`npx amxts upgrade` in the project updates it with the core.

### 📦 Dependencies

| Package | From | To |
| --- | --- | --- |
| `@amxts/core` | `^0.1.0` | `^0.2.0` |

### 🩹 Fixes

- The plugin's version is the package's ([c53a7ee](https://github.com/amxts/config-core/commit/c53a7ee))

### 💅 Refactors

- Import the core's API by its package name ([7e12991](https://github.com/amxts/config-core/commit/7e12991))
- Command handlers take one object ([4240f17](https://github.com/amxts/config-core/commit/4240f17))
- Admin right by its `lowerCamelCase` name ([74c8ddf](https://github.com/amxts/config-core/commit/74c8ddf))

### 📖 Documentation

- The Pawn natives without a plugin the reader never met ([7de1140](https://github.com/amxts/config-core/commit/7de1140))
- The natives' limits without comparing to Pawn ([cedf727](https://github.com/amxts/config-core/commit/cedf727))

### ❤️ Contributors

- Ernest Manukyan
