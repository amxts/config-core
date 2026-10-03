# Config Core for Pawn plugins

[English](PAWN.md) | [Русский](PAWN.ru.md)

Config Core gives Pawn plugins the 28 natives of `universal_config.inc` — `cfg_load_file`, `cfg_get_value`, `cfg_set_int` and the rest — with their signatures, so compiled `.amxx` plugins (Menu Core's Pawn users among them) work against it unchanged.

Pawn plugins write `#include <universal_config>`; the package ships `include/universal_config.inc`. Only one plugin on a server can give these natives: if another Pawn plugin in `plugins.ini` registers `cfg_*` natives too, comment it out.

## How the natives behave

- No length limits: a key or a value is as long as it is written, a section keeps every entry, blocks nest as deep as they are written, any number of files loads.
- A number reads the way `parseFloat` reads it (`1e5` is 100000) and is written as the number it is (`2.5`, not `2.500000`).
- `CFG_CONTENT_SIMPLE` and `CFG_CONTENT_STRINGS` are one content: a block of either holds a line of values, and `cfg_set_value` writes into it.
