# Changelog

## v0.2.1

> For amxts 0.3.7 and later.

### 👀 Highlights

#### 💬 Comments in a config file

`setComment(path, text)` puts a comment line above a value, including a value the plugin added itself. `setComment(path, "")` removes it.

```ts
const maps = configs.read("maps");
maps.setNumber("de_dust2.rounds", 20);
maps.setComment("de_dust2.rounds", "Rounds before the map changes");
maps.save();
```

### 🩹 Important fixes

- `amxts_plugins` showed Config Core as 0.2.0 whatever its version. It says the package's version now ([daedc5f](https://github.com/amxts/config-core/commit/daedc5f)).

### 👉 Changelog

[compare changes](https://github.com/amxts/config-core/compare/v0.2.0...v0.2.1)

### 🚀 Enhancements

- `ConfigNode.setComment` for a node's comment ([d1a7956](https://github.com/amxts/config-core/commit/d1a7956))

### 🩹 Fixes

- The plugin says the package's version ([daedc5f](https://github.com/amxts/config-core/commit/daedc5f))

### ❤️ Contributors

- Ernest Manukyan ([@kukson777](https://github.com/kukson777))

## v0.2.0

> Config Core for amxts 0.3. It needs `@amxts/core` 0.3, and `npx amxts upgrade` moves a project to it.

Nothing changes for you in how configs are read. The plugin prints through the 0.3 core's `player.print` ([cc0fc72](https://github.com/amxts/config-core/commit/cc0fc72)), which 0.2 doesn't have, so this is a minor release with the new core as its minimum. It also reports its version, `0.2.0` ([f85ddc8](https://github.com/amxts/config-core/commit/f85ddc8)).

### 👉 Changelog

[compare changes](https://github.com/amxts/config-core/compare/v0.1.2...v0.2.0)

### 🩹 Fixes

- The plugin says its version, `0.2.0` ([f85ddc8](https://github.com/amxts/config-core/commit/f85ddc8))

### 💅 Refactors

- `player.print`, not the free print ([cc0fc72](https://github.com/amxts/config-core/commit/cc0fc72))

### ❤️ Contributors

- Ernest Manukyan ([@kukson777](https://github.com/kukson777))

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

- Ernest Manukyan ([@kukson777](https://github.com/kukson777))
