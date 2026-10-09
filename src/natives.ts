/**
 * Config Core for Pawn plugins: the 28 cfg_* natives of the original
 * universal_config.amxx, as include/universal_config.inc declares them.
 */
import { Player, plugin, server } from "@amxts/core";
import { console_print } from "@amxts/core/natives";
import { setBaseDir } from "./index";
import * as ini from "./ini";

plugin({ name: "Config Core", version: "0.2.0", author: "kukson777", description: "INI configs for plugins: the cfg_* natives", include: "universal_config.inc" });

/** A loaded config file. */
export enum ConfigFile {
	CFG_FILE_INVALID = -1,
}

/** A section of a loaded file. */
export enum ConfigSection {
	CFG_SECTION_INVALID = -1,
}

/** What a key is: a `key = value` line or a `key = { ... }` block. */
export enum EntryType {
	CFG_ENTRY_SIMPLE,
	CFG_ENTRY_BRACKET,
}

/** What a key holds: one value, a line of strings, or rows - one value is a line of one string. */
export enum ContentType {
	CFG_CONTENT_SIMPLE,
	CFG_CONTENT_STRINGS,
	CFG_CONTENT_ENTRIES,
}

server.addEventListener("init", () => {
	console.log("[ConfigCore] Plugin initialized (v0.2.0)");
});

server.addCommand("dump_config", ({ player }) => dumpConfig(player), { access: "cvar", description: "Dumps all configurations" });

/** Every loaded section and its entries: headings to the admin's console, entries to the server's, as the original does. */
function dumpConfig(player: Player) {
	player.print("Current Configuration Dump:", "console");
	for (const section of ini.dump()) {
		player.print(section.heading, "console");
		for (const line of section.lines) console_print(0, line);
	}
}

/**
 * Loads a config file from `configs/<base dir>/`; ".ini" is added when the
 * name has none. A file that is not there still gets a handle, empty.
 */
export function cfg_load_file(fileName: string) {
	return ini.configHandle(ini.loadFile(fileName));
}

/** A section of a loaded file by its name, or CFG_SECTION_INVALID. */
export function cfg_get_section(cfg: ConfigFile, sectionName: string) {
	const config = ini.configByHandle(cfg);
	const found = config != null ? ini.section(config, sectionName) : null;
	return found != null ? ini.sectionHandle(found) : -1;
}

/**
 * The value of a key, or of a path ("block/subkey"), into value[]; index is
 * the value's place in its line. false when there is none.
 */
export function cfg_get_value(section: ConfigSection, key: string, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.getValue(found, key, index) : null;
}

/** A value by a path: index is its place in the line, lineIndex the row of the block. */
export function cfg_get_value_by_path(section: ConfigSection, path: string, index = 0, lineIndex = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.getValueByPath(found, path, index, lineIndex) : null;
}

/** The whole number a key or path holds; 0 when there is none. */
export function cfg_get_int(section: ConfigSection, key: string, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.getInt(found, key, index) : 0;
}

/** The number a key or path holds; 0.0 when there is none. */
export function cfg_get_float(section: ConfigSection, key: string, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.getNumber(found, key, index) : 0;
}

/** true when the value is a whole number other than 0. */
export function cfg_get_bool(section: ConfigSection, key: string, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.getBoolean(found, key, index) : false;
}

/**
 * The words of a key's line (index: which line, when the key is there more
 * than once); for a block, every value of every row. The caller destroys the
 * array; Invalid_Array when there are no words.
 */
export function cfg_get_value_array(section: ConfigSection, key: string, index = 0) {
	const found = ini.sectionByHandle(section);
	if (found == null) return null;
	return ini.getWords(found, key, index);
}

/** The numbers of value index as an array of Floats; the caller destroys it. Invalid_Array when there are none. */
export function cfg_get_float_array(section: ConfigSection, key: string, index = 0) {
	const found = ini.sectionByHandle(section);
	if (found == null) return null;
	const numbers = ini.getNumbers(found, key, index);
	return numbers != null && numbers.length > 0 ? numbers : null;
}

/**
 * Every value of the line a path leads to (lineIndex: the row of a block), as
 * written. The caller destroys the array.
 */
export function cfg_get_value_array_by_path(section: ConfigSection, path: string, index = 0, lineIndex = 0) {
	const found = ini.sectionByHandle(section);
	if (found == null) return null;
	return ini.getValues(found, path, index, lineIndex);
}

/** The section's keys in file order; Invalid_Array when it has none. */
export function cfg_get_top_level_keys(section: ConfigSection) {
	const found = ini.sectionByHandle(section);
	if (found == null) return null;
	const keys = ini.keys(found);
	return keys.length > 0 ? keys : null;
}

/**
 * The whole section, as an array of three: the keys, the values (an array of
 * strings per key, "{block}" for a block) and [key, value] index pairs.
 */
export function cfg_get_section_data(section: ConfigSection) {
	const found = ini.sectionByHandle(section);
	if (found == null) return null;
	const entries = ini.entries(found);
	if (entries.length == 0) return null;

	const pairs: number[][] = [];
	for (let i = 0; i < entries.length; i++) pairs.push([i, i]);
	const data: SectionData = {
		keys: entries.map(entry => entry.key),
		values: entries.map(entry => (entry.block ? ["{block}"] : entry.values)),
		pairs,
	};
	return data;
}

/** What cfg_get_section_data hands Pawn: an Array of these three, in this order. */
interface SectionData {
	keys: string[];
	values: string[][];
	/** [key, value] index pairs. */
	pairs: number[][];
}

/** How many values a line has, rows a block has, or - for a key that is there more than once - how many times it is. */
export function cfg_get_array_size(section: ConfigSection, key: string) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.size(found, key) : 0;
}

/** Sets a value; a key that is not there is made. For a block, lineIndex is the row. */
export function cfg_set_value(section: ConfigSection, key: string, value: string, index = 0, lineIndex = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.set(found, key, value, index, lineIndex) : false;
}

/** Sets a whole number. */
export function cfg_set_int(section: ConfigSection, key: string, value: number, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.setInt(found, key, value, index) : false;
}

/** Sets a number; it is written as it was given, 2.5 as "2.5". */
export function cfg_set_float(section: ConfigSection, key: string, value: number, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.setNumber(found, key, value, index) : false;
}

/** Sets 1 or 0. */
export function cfg_set_bool(section: ConfigSection, key: string, value: boolean, index = 0) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.setBoolean(found, key, value, index) : false;
}

/** Removes every entry of the key; false when there was none. */
export function cfg_delete_key(section: ConfigSection, key: string) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.remove(found, key) : false;
}

/** Whether the section has the key. */
export function cfg_has_key(section: ConfigSection, key: string) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.has(found, key) : false;
}

/** A section of the file; one that is not there is made, in memory. */
export function cfg_create_section(cfg: ConfigFile, sectionName: string) {
	const config = ini.configByHandle(cfg);
	return config != null ? ini.sectionHandle(ini.createSection(config, sectionName)) : -1;
}

/** Makes the key a line of values or a block; a key that is not there is made. */
export function cfg_set_entry_type(section: ConfigSection, key: string, entryType: EntryType) {
	const kind = entryType == EntryType.CFG_ENTRY_BRACKET ? "block" : "value";
	const found = ini.sectionByHandle(section);
	if (found == null) return false;
	ini.setKind(found, key, kind);
	return true;
}

/** Says what the key holds; a key that is not there is made. */
export function cfg_set_entry_content_type(section: ConfigSection, key: string, contentType: ContentType) {
	const content = contentType == ContentType.CFG_CONTENT_ENTRIES ? "entries" : "strings";
	const found = ini.sectionByHandle(section);
	if (found == null) return false;
	ini.setContent(found, key, content);
	return true;
}

/**
 * Writes one section to a file; the file's other sections are not in it.
 * With cfg = CFG_FILE_INVALID the section is looked for in every loaded file.
 */
export function cfg_write_file(cfg: ConfigFile, fileName: string, sectionName: string) {
	const config = ini.configByHandle(cfg);
	// No file named: the section of that name in any file, the last one loaded.
	const found = config != null ? ini.section(config, sectionName) : ini.findSection(sectionName);
	return found != null && ini.writeSection(found, fileName);
}

/**
 * Saves every section of the file with the comments it was read with. The
 * file name has to be given: without one it returns false.
 */
export function cfg_save_config(cfg: ConfigFile, fileName?: string) {
	const config = ini.configByHandle(cfg);
	return config != null && ini.saveFile(config, fileName ?? "");
}

/** The folder under configs/ that file names are relative to. */
export function cfg_set_base_dir(dir: string) {
	setBaseDir(dir);
}

/** How many sections are loaded, across every file. */
export function cfg_get_sections_count() {
	return ini.sectionCount();
}

/** A section's name by its number, 0 .. cfg_get_sections_count() - 1. */
export function cfg_get_section_name(index: number) {
	return ini.sectionByHandle(index)?.name ?? null;
}

/**
 * The comment line written above row `row` of the block `key` - "; ID | VALUE",
 * say; "" removes it. false when there is no such block or row.
 */
export function cfg_set_row_comment(section: ConfigSection, key: string, row: number, comment: string) {
	const found = ini.sectionByHandle(section);
	return found != null ? ini.setRowComment(found, key, row, comment) : false;
}
