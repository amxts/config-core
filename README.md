<div align="center">

<img src="assets/logo.svg" width="96" alt="Config Core">

# Config Core

*Configs in INI, YAML or JSON, read into typed objects and written back*

[![amxts module](https://img.shields.io/badge/amxts-module-3178c6?style=flat-square)](https://amxts.github.io/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [File formats](#file-formats) • [INI files](#ini-files) • [Pawn plugins](#pawn-plugins)

**English** | [Русский](README.ru.md)

</div>

Read a config file — INI, YAML or JSON, whichever the admin wrote — into an object shaped like its defaults, typed in the editor, change it and write the file back, with its comments where they were.

## Features

- **A typed object.** `configs.load("settings", { chat: { prefix: "[Server]" } })` gives `settings.chat.prefix`, typed as its default is; a typo is the editor's error, not a setting silently missing.
- **Three formats, one API.** `settings.yaml`, `settings.json` or `settings.ini`: the same code reads each of them.
- **Mistakes said where they are.** A value of the wrong kind, a name not in its union, an unknown key — each is named in the server console with the file and the line (and the column in YAML and JSON), with "did you mean", and the default is kept.
- **Writes back what it read.** `configs.save(settings)` puts the values in their places; comments on lines of their own survive, a missing file is written as YAML.
- **Files of any shape too.** A tree of values with paths — `shop.items[0].name` — for a file whose keys are not known beforehand.
- **INI with blocks and rows.** Sections, blocks and rows of values read into the same objects — and the 28 `cfg_*` natives serve them to Pawn plugins.
- **One instance per server.** Every plugin, TypeScript or Pawn, sees the same loaded files and the same base folder.

## Installation

```bash
npx amxts module add config-core
```

It installs the package and adds it to `modules` in your project's `amxts.config.ts`. The module's options go beside it, under `configs`:

```ts
export default defineConfig({
	modules: ["@amxts/config-core"],
	configs: {
		baseDir: "myserver",   // names are read from configs/myserver/
	},
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `baseDir` | `""` | The folder under `configs/` that file names are read from; `""` is `configs/` itself. |

A module that reads its files through Config Core, such as [Menu Core](https://github.com/amxts/menu-core), brings it along — there is nothing to add for it.

## Usage

A plugin uses the module as `configs`, without an import line: the build adds the import to the plugins that use it, and builds the module only when some plugin does.

```ts
const settings = configs.load("settings", {   // configs/myserver/settings.yaml, .json or .ini
	chat: { prefix: "[Server]" },
	round: { time: 2.5 },
	maps: ["de_dust2"],
});

console.log(`${settings.chat.prefix} ${settings.maps.length} maps`);   // from the file, or the default

settings.round.time = 3;
configs.save(settings);                       // in the file's format, comments kept
```

The defaults say the object's shape. What the file has replaces the default, value by value; what it leaves out stays the default. An interface gives the fields descriptions, optional fields and unions of names:

```ts
type Mode = "normal" | "dm" | "knife";

interface Settings {
	/** The text before every chat message. */
	chat: { prefix: string };
	round: { time: number; mode: Mode };
	maps: string[];
	/** Shown on join; left out, nothing is shown. */
	motd?: string;
}

const settings = configs.load<Settings>("settings", {
	chat: { prefix: "[Server]" },
	round: { time: 2.5, mode: "normal" },
	maps: [],
});
```

A mistake in the file keeps the default, and the console says where it is:

```
[ConfigCore] configs/myserver/settings.yaml:6:9: "mode" is "dmm", not one of "normal", "dm", "knife" - did you mean "dm"? - the default stays
[ConfigCore] configs/myserver/settings.yaml:2:3: unknown key "prefx" in "chat" - did you mean "prefix"?
```

| In the object | In the file |
| --- | --- |
| `string`, `number`, `boolean` | a value; a number may be text, a boolean `true`/`false`, `yes`/`no`, `on`/`off` in any case or a number (0 is false) |
| a union of names, `"normal" \| "dm"` | one of them |
| `string[]`, `number[]`, `boolean[]`, a list of names | a list — an item of another kind is left out |
| `string[][]` (of text, numbers, booleans or names) | a list of lists: rows of values; an INI block of rows |
| an object, nested as deep as needed | an object |
| a list of objects | a list of objects — a field an item leaves out is empty, and said |
| `Map<string, number>` (of text, numbers, booleans or names) | an object |
| `field?: T` | may be left out: `undefined` |

- `configs.load()` gives a copy of the defaults with the file's values in it; a second call reads the file again. `configs.save(settings)` writes every field into the file it came from.
- An object `load()` read without a type has no type name to write in a function's parameter: to pass the settings around, declare an interface and write `configs.load<Settings>(...)`.
- The build reads the shape from the source: the defaults as an object literal (a list with an item in it), or the type given — `configs.load<Settings>(...)`. What it cannot read — an empty list without a type, a list of lists of lists — stops the build with the place and the fix.

### Which file is read

`load("settings")` and `read("settings")` read the first of `settings.ini`, `settings.yaml`, `settings.yml`, `settings.json` and `settings.jsonc` that is there. When two of them are, the first is read and the server console says so: keep one. A name with its extension — `load("settings.json", ...)` — reads that file. A file that is not there reads as the defaults, and is saved as `settings.yaml`.

### Files of unknown shape

A file whose keys are not known beforehand — a list of maps with settings of their own, a file another plugin writes — reads as a tree of values:

```ts
const maps = configs.read("maps");

for (const map of maps.values()) {
	console.log(`${map.key}: ${map.getNumber("rounds", 30)} rounds`);
}

maps.setNumber("de_dust2.rounds", 20);
maps.save();
```

A value is a `ConfigNode`: an object, an array, text, a number, a boolean or null (`kind`), with the file, line and column it was read from. A path leads into it — `chat.prefix`, `items[0].name` — and a getter takes the value's fallback for when it is not there or not of that kind.

### API

| Function | What it does |
| --- | --- |
| `load(name, defaults)` | Reads a config file into an object shaped like `defaults`. |
| `save(settings)` | Writes an object `load()` read back into its file. |
| `read(name)` | Reads a config file as a tree of values; the file's top value. |
| `resolve(name)` | The file `load(name)` and `read(name)` read, e.g. `"settings.yaml"`. |
| `parse(text, format)` | Reads a text — `"yaml"`, `"json"` or `"ini"` — as a tree. |

| `ConfigNode` | What it does |
| --- | --- |
| `kind` · `key` · `file` · `format` · `line` · `column` | What the value is, and where it was read. |
| `get(path)` · `has(path)` | The value a path leads to, or `null`; whether there is one. |
| `keys(path?)` · `values(path?)` | An object's keys; an array's items or an object's values. |
| `getString(path?, fallback?)` · `getNumber` · `getBoolean` · `getStrings` | A value as text, a number, a boolean, a list of text. |
| `set(path, text)` · `setNumber` · `setBoolean` · `setStrings` | Sets a value, making the objects on its path; `false` where the path goes through text or a number. |
| `remove(path)` · `save()` | Removes a value; writes the whole file back in its format. |

## File formats

The same settings in each of them:

```yaml
# settings.yaml
chat:
  prefix: "[Server]"
  rules:
    - Be nice
    - No cheats
round:
  time: 2.5
hud:
  enabled: true
```

```jsonc
// settings.json or settings.jsonc
{
  "chat": {
    "prefix": "[Server]",
    "rules": ["Be nice", "No cheats"],
  },
  "round": { "time": 2.5 },
  "hud": { "enabled": true },
}
```

```ini
; settings.ini
[chat]
prefix = [Server]
rules = "Be nice" "No cheats"

[round]
time = 2.5

[hud]
enabled = 1
```

- **YAML:** mappings and lists, indented or in `{ }` and `[ ]`; plain, `'single'` and `"double"`-quoted text with its escapes; `|` and `>` blocks for text of several lines; numbers, `true`/`false`, `null` and `~` as YAML 1.2 reads them — `yes` is text; `#` comments; `---` before the document and `...` after it.
- **Not read in YAML:** anchors and aliases (`&`, `*`), tags (`!`), complex keys (`?`), directives (`%YAML`), several documents in one file, and a plain value going on over several lines. The file then reads empty, and the console names the line and the column: `configs/settings.yaml:4:9: anchors and aliases (& and *) are not supported - write the value out`.
- **JSON:** as JSON is written, plus JSONC's `//` and `/* */` comments and a comma after the last member or item — in `.json` files too.
- **INI:** each `[section]` is an object of the top — `[chat]` with `prefix = [Server]` is `settings.chat.prefix`; a line of several values is a list; a `key = { ... }` block is an object, or a list of rows. The rules INI adds are under [INI files](#ini-files).
- **Saving** writes the file in its own format: comments on lines of their own and blank lines stay; a comment after a value on its line, and comments inside `{ }` and `[ ]` in YAML, do not. JSON keeps its indentation.

## INI files

An INI config reads into the same kind of object: each `[section]` is an object, a `key = { ... }` block of keys an object in it, a line of several values a list, and a block of rows in quotes a list of lists:

```ini
; configs/myserver/settings.ini
[MAIN]
CHAT_PREFIX = [MYPLUGIN]
MAPS = de_dust2 de_inferno de_nuke

HUD = {
	HIDE_TIME = 255 50 50
}

CVARS = {
	"mp_timelimit" "30"
	"mp_freezetime" "3"
}
```

```ts
const settings = configs.load("settings", {
	MAIN: {
		CHAT_PREFIX: "[Server]",
		MAPS: ["de_dust2"],
		HUD: { HIDE_TIME: [255, 255, 255] },
		CVARS: [["mp_timelimit", "20"]],
	},
});

for (const row of settings.MAIN.CVARS) {
	const cvar = new Cvar(row[0]);
	cvar.value = row[1];
}
```

- A block of rows stays a block when the object is saved — rows of one value too; the comments above its rows stay.
- A path into the tree of such a file (`configs.read()`) is written the same way: `MAIN.HUD.HIDE_TIME[0]`, `MAIN.CVARS[1][0]`. An item of a list is `[0]`: `MAIN.MAPS.0` looks for a key `0`.

> [!WARNING]
> **In an INI file:**
>
> - **Keys are found in any case, as the Pawn natives find them; section names are not:** `[main]` is not `MAIN`. A name the file has twice is its last section.
> - **A value with spaces is quoted:** `TITLE = "Main menu"`. Unquoted, it is a list of words: a text field keeps its default and says why, and Pawn's `cfg_*` natives and Menu Core read the first word.
> - **No place for a value at the top of the object that is not an object, nor for a list of objects:** in an INI file such a field stays its default, and the console says so once — write that config in YAML or JSON.

## Pawn plugins

A Pawn plugin reads and writes configs through Config Core too, with its 28 natives whose names start with `cfg_`: `cfg_load_file`, `cfg_get_value`, `cfg_set_int` and the rest. They read INI files. The package ships their include in `include/`:

```pawn
#include <universal_config>
```

A Pawn plugin already compiled against this include works as it is, with nothing to rebuild.

Config Core runs on the server as one of the project's plugins. When no TypeScript plugin of the project uses it, keep it in the build for the Pawn plugins: `pawn: ["@amxts/config-core"]` in `amxts.config.ts`. Every native with its signature: [PAWN.md](PAWN.md).
