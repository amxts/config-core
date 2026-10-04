# Changelog

## v0.2.0

[compare changes](https://github.com/amxts/config-core/compare/v0.1.0...v0.2.0)

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

### 💅 Refactors

- Import the core's API by its package name ([7e12991](https://github.com/amxts/config-core/commit/7e12991))
- Command handlers take one object ([4240f17](https://github.com/amxts/config-core/commit/4240f17))
- Admin right by its `lowerCamelCase` name ([74c8ddf](https://github.com/amxts/config-core/commit/74c8ddf))

### 📖 Documentation

- The Pawn natives without a plugin the reader never met ([7de1140](https://github.com/amxts/config-core/commit/7de1140))
- The natives' limits without comparing to Pawn ([cedf727](https://github.com/amxts/config-core/commit/cedf727))

### ❤️ Contributors

- Ernest Manukyan
