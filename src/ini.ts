/**
 * The INI engine of the original universal_config: files of [sections] with
 * keys, blocks and rows, read and written back with their comments, keys
 * found by "a/b/c" paths and values by their index. The 28 cfg_* natives are
 * made of it (natives.ts), and `read()` reads an INI file through it. Not
 * part of the API: a TypeScript plugin reads a config with `load()` or
 * `read()`.
 */
import * as fs from "~/fs";
import { configPath, writeLines } from "./files";
import { writeComments } from "./tree";

/** A `key = value` line, or a `key = { ... }` block. */
export type EntryKind = "value" | "block";

/** What a block holds: a line of strings, or rows. The original's CFG_CONTENT_SIMPLE is a line of one string. */
export type ContentKind = "strings" | "entries";

/** A line of a section or a row of a block. */
export interface Entry {
	/** The name before `=`; "" for a row of a block. */
	key: string;
	kind: EntryKind;
	content: ContentKind;
	/** The entry's values, in order; empty for a block of rows. */
	values: string[];
	/** A block's rows; empty otherwise. */
	rows: Entry[];
	/** The comment and blank lines read before it; null for one made at run time. */
	comments: string[] | null;
	/** The line of the file it was read from, from 1; 0 for one made at run time. */
	line: number;
}

/** A [section] of a config file. */
export interface Section {
	name: string;
	/** The comment and blank lines read before it; null for one made at run time. */
	comments: string[] | null;
	/** The section's lines, in file order. */
	entries: Entry[];
	/** The line of the file it was read from, from 1; 0 for one made at run time. */
	line: number;
}

/** A loaded config file. */
export interface Config {
	/** The name it was loaded under, ".ini" included. */
	name: string;
	/** In file order; a name the file has twice is there twice. */
	sections: Section[];
}

/** One entry of a section as `entries()` lists it. */
export interface SectionEntry {
	key: string;
	/** The entry's values; empty for a block. */
	values: string[];
	block: boolean;
}

/** A dump of one section - the heading, then the entries - as `dump_config` prints it. */
export interface SectionDump {
	/** "Section 0: NAME". */
	heading: string;
	lines: string[];
}

/** Where a path leads: the entry, and the line of a block it means. */
interface Found {
	entry: Entry;
	line: number;
}

// Every config and every section loaded, in the order they came: a Pawn
// plugin knows them by their place here.
const configs: Config[] = [];
const sections: Section[] = [];

function entry(key: string, kind: EntryKind, values: string[], comments: string[] | null, line = 0) {
	const made: Entry = { key, kind, content: kind == "block" ? "entries" : "strings", values, rows: [], comments, line };
	return made;
}

function addSection(config: Config, name: string, comments: string[] | null, line = 0) {
	const made: Section = { name, comments, entries: [], line };
	config.sections.push(made);
	return made;
}

/** Keys are compared case-insensitively, as equali does. */
function sameKey(a: string, b: string) {
	return a.toLowerCase() == b.toLowerCase();
}

/** "text" without its quotes; anything else as it is. */
function unquote(text: string) {
	return text.length >= 2 && text.startsWith("\"") && text.endsWith("\"") ? text.slice(1, -1) : text;
}

/** Words split on spaces and tabs; a "quoted" one is kept whole, an empty "" dropped. */
function splitValues(text: string) {
	const words: string[] = [];
	let rest = text.replaceAll("\t", " ").trim();
	while (rest.length > 0) {
		if (rest.startsWith("\"")) {
			let close = rest.indexOf("\"", 1);
			if (close < 0) close = rest.length;
			const word = rest.slice(1, close);
			if (word.length > 0) words.push(word);
			rest = rest.slice(close + 1).trim();
			continue;
		}

		let space = rest.indexOf(" ");
		if (space < 0) space = rest.length;
		words.push(rest.slice(0, space));
		rest = rest.slice(space).trim();
	}
	return words;
}

/** A row of "quoted" "values"; only spaces may stand between them - a tab ends the row. */
function quotedRow(line: string) {
	const values: string[] = [];
	let rest = line;
	while (rest.startsWith("\"")) {
		let close = rest.indexOf("\"", 1);
		if (close < 0) close = rest.length;
		values.push(rest.slice(1, close).trim());
		rest = rest.slice(close + 1);
		while (rest.startsWith(" ")) rest = rest.slice(1);
	}
	return values;
}

/** `key = value ; comment` as the key and the value. */
function keyAndValue(line: string) {
	const equals = line.indexOf("=");
	const key = equals < 0 ? "" : line.slice(0, equals).trim();
	const value = equals < 0 ? line : line.slice(equals + 1);
	return [key, value.split(";")[0].trim()];
}

/** "a/b/c" as its parts, empty ones skipped. */
function splitPath(path: string) {
	return path.split("/").map(part => part.trim()).filter(part => part.length > 0);
}

function withIni(name: string) {
	return name.includes(".ini") ? name : `${name}.ini`;
}

/** The whole number the text starts with; 0 when there is none. */
function toInt(text: string) {
	const value = parseInt(text, 10);
	return isNaN(value) ? 0 : value;
}

/** The number the text starts with; 0 when there is none. */
function toNumber(text: string) {
	const value = parseFloat(text.trim());
	return isNaN(value) ? 0 : value;
}

function named(entries: Entry[], key: string) {
	return entries.filter(each => sameKey(each.key, key));
}

/** How many a key holds: rows of a block of rows, values otherwise. */
function sizeOf(entry: Entry) {
	return entry.kind == "block" && entry.content == "entries" ? entry.rows.length : entry.values.length;
}

/**
 * The row a path's parts lead to under `rows`. Where a part matches several
 * rows, `line` picks one, and the parts after it start again from the first.
 */
function follow(rows: Entry[], parts: string[], line: number) {
	let current = rows;
	let target = line;
	let found: Entry | null = null;
	for (const part of parts) {
		const matches = named(current, part);
		if (matches.length == 0) return null;

		if (matches.length == 1) {
			found = matches[0];
		} else {
			if (target >= matches.length) return null;
			found = matches[target];
			target = 0;
		}

		current = found.rows;
	}
	if (found == null) return null;
	const result: Found = { entry: found, line: target };
	return result;
}

/** The values of row `line` of a block, when it is a line of values. */
function rowValues(rows: Entry[], line: number) {
	if (line >= rows.length || rows[line].kind != "value") return null;
	return rows[line].values;
}

/** The `index`-th value without its quotes, or null past the end. */
function pick(values: string[] | null, index: number) {
	if (values == null || index >= values.length) return null;
	return unquote(values[index]);
}

/**
 * The values a path leads to, `line` in its block. With the key in the
 * section more than once and no line asked for, `index` picks which one -
 * and, as in the original, still picks the value in it.
 */
function valuesAt(section: Section, path: string, index: number, line: number) {
	const parts = splitPath(path);
	if (parts.length == 0 || index < 0 || line < 0) return null;
	const matches = named(section.entries, parts[0]);
	if (matches.length == 0) return null;

	let occurrence = line;
	let target = line;

	if (matches.length == 1) {
		occurrence = 0;
	} else if (line == 0) {
		occurrence = index;
		target = 0;
	}

	if (occurrence >= matches.length) return null;

	let top = matches[occurrence];

	if (parts.length > 1) {
		const found = follow(top.rows, parts.slice(1), target);
		if (found == null) return null;
		top = found.entry;
		target = found.line;
	}

	return top.kind == "block" ? rowValues(top.rows, target) : top.values;
}

/** A plain key's value: the first entry of that name, when it is a line of values. */
function plainValue(section: Section, key: string, index: number) {
	const matches = named(section.entries, key);
	if (matches.length == 0 || matches[0].kind != "value" || index < 0) return null;
	return pick(matches[0].values, index);
}

/** The `index`-th value of a key's line, without its quotes; null when there is none. A key with "/" is a path. */
export function getValue(section: Section, key: string, index = 0) {
	return key.includes("/") ? pick(valuesAt(section, key, index, 0), index) : plainValue(section, key, index);
}

function putValue(values: string[], index: number, value: string) {
	while (values.length <= index) values.push("");
	values[index] = value;
}

/** A value of row `line` of a block, the rows up to it made when missing. */
function setRow(block: Entry, value: string, index: number, line: number) {
	if (line < 0) return false;
	while (block.rows.length <= line) block.rows.push(entry("", "value", [], null));
	putValue(block.rows[line].values, index, value);
	return true;
}

/** A plain key: a line of values - `index` picks which, when it is there more than once - or a row of its block. */
function setPlain(section: Section, key: string, value: string, index: number, line: number) {
	const matches = named(section.entries, key);
	let target = matches.find((each, i) => each.kind == "block" || i == index);

	if (target == null) {
		target = entry(key, "value", [], null);
		section.entries.push(target);
	}

	if (target.kind == "block" && target.content == "entries") return setRow(target, value, index, line);
	putValue(target.values, index, value);
	return true;
}

/** A path "a/b/c": the blocks on the way are made when missing; `index` picks every part's occurrence and the value. */
function setByPath(section: Section, parts: string[], value: string, index: number) {
	let top: Entry | null = null;
	const matches = named(section.entries, parts[0]);
	if (index < matches.length) top = matches[index];

	if (top == null) {
		top = entry(parts[0], "block", [], null);
		section.entries.push(top);
	}

	if (top.kind != "block") return false;

	let rows = top.rows;
	for (let level = 1; level < parts.length; level++) {
		const last = level == parts.length - 1;
		const found = named(rows, parts[level]);
		let row: Entry | null = index < found.length ? found[index] : null;

		if (row == null) {
			row = entry(parts[level], last ? "value" : "block", [], null);
			rows.push(row);
		}

		if (last) {
			if (row.kind != "value") return false;
			putValue(row.values, index, value);
			return true;
		}

		if (row.kind != "block") return false;
		rows = row.rows;
	}
	return true;
}

/** Reads an INI text into the config's sections. */
export function readSections(config: Config, text: string) {
	let section: Section | null = null;
	// The blocks open where the reader is, innermost last.
	const open: Entry[] = [];
	// Comments and blank lines wait for what comes next and are written back before it.
	let pending: string[] | null = null;

	const rows = text.split("\n");
	for (let lineNumber = 1; lineNumber <= rows.length; lineNumber++) {
		const line = rows[lineNumber - 1].trim();

		if (line.length == 0 || line.startsWith(";")) {
			pending ??= [];
			pending.push(line);
			continue;
		}

		if (line.startsWith("[")) {
			const close = line.indexOf("]");
			section = addSection(config, close < 0 ? line.slice(1) : line.slice(1, close), pending, lineNumber);
			open.length = 0;
			pending = null;
			continue;
		}

		// Lines before the first section belong to none.
		if (section == null) continue;

		if (line.startsWith("}")) {
			open.pop();
			continue;
		}

		const into = open.length > 0 ? open[open.length - 1].rows : section.entries;

		if (line.includes("=") && line.endsWith("{")) {
			const block = entry(keyAndValue(line)[0], "block", [], pending, lineNumber);
			pending = null;
			into.push(block);
			open.push(block);
			continue;
		}

		if (open.length > 0 && line.startsWith("\"")) {
			into.push(entry("", "value", quotedRow(line), pending, lineNumber));
			pending = null;
			continue;
		}

		const pair = keyAndValue(line);
		into.push(entry(pair[0], "value", splitValues(pair[1]), pending, lineNumber));
		pending = null;
	}
}

function quoted(values: string[]) {
	return values.map(value => `"${value}"`).join(" ");
}

/** An entry and what is inside it; a keyless row goes out as "quoted" "values". */
function writeEntry(lines: string[], written: Entry, level: number) {
	const indent = "\t".repeat(level);
	writeComments(lines, written.comments, indent);

	if (written.kind == "value") {
		const values = written.key.length == 0 ? quoted(written.values) : `${written.key} = ${written.values.join(" ")}`;
		lines.push(`${indent}${values}`);
		return;
	}

	lines.push(`${indent}${written.key} = {`);
	if (written.content == "strings") lines.push(`${indent}\t${quoted(written.values)}`);

	if (written.content == "entries") {
		for (const row of written.rows) writeEntry(lines, row, level + 1);
	}

	lines.push(`${indent}}`);
}

function writeSectionLines(lines: string[], written: Section, spaced: boolean) {
	writeComments(lines, written.comments, "");
	lines.push(`[${written.name}]`);
	for (const each of written.entries) {
		// As the original saves a file: an entry with no comment lines before it
		// gets a blank one. Writing a single section does not.
		if (spaced && each.comments == null) lines.push("");
		writeEntry(lines, each, 0);
	}
}

function dumpEntry(lines: string[], dumped: Entry, level: number) {
	const indent = "\t".repeat(level);

	if (dumped.kind == "value") {
		lines.push(`${indent}${dumped.key} = ${dumped.values.join(" ")}`);
		return;
	}

	lines.push(`${indent}${dumped.key} = {`);
	if (dumped.content == "strings") lines.push(`${indent}    ${dumped.values.join(" ")}`);

	if (dumped.content == "entries") {
		for (const row of dumped.rows) dumpEntry(lines, row, level + 1);
	}

	lines.push(`${indent}}`);
}

/**
 * Loads `configs/<baseDir>/<name>`; ".ini" is added when the name has none.
 * A file that is not there loads empty, for a plugin to fill and save.
 */
export function loadFile(name: string) {
	const config: Config = { name: withIni(name.trim()), sections: [] };
	configs.push(config);
	const text = fs.readFileSync(configPath(config.name));
	if (text != null) readSections(config, text);
	for (const each of config.sections) sections.push(each);
	return config;
}

/** A section of a config by its name - the last one, when the file has two. */
export function section(config: Config, name: string) {
	return config.sections.findLast(each => each.name == name);
}

/** The section, made when the config does not have it. */
export function createSection(config: Config, name: string) {
	const found = section(config, name);
	if (found != null) return found;
	const made = addSection(config, name, null);
	sections.push(made);
	return made;
}

/**
 * Writes every section of a config to `configs/<baseDir>/<name>`, with the
 * comments and blank lines it was read with. A section or an entry made at
 * run time gets a blank line before it. False without a name.
 */
export function saveFile(config: Config, name: string) {
	const file = name.trim();
	if (file.length == 0) return false;
	const lines: string[] = [];
	for (const each of config.sections) {
		// A name the file has twice is the last section of that name.
		if (section(config, each.name) != each) continue;
		if (lines.length > 0 && each.comments == null) lines.push("");
		writeSectionLines(lines, each, true);
	}
	return writeLines(configPath(withIni(file)), lines);
}

/** Writes one section alone to `configs/<baseDir>/<name>`; `saveFile()` writes them all. */
export function writeSection(written: Section, name: string) {
	if (name.length == 0) return false;
	const lines: string[] = [];
	writeSectionLines(lines, written, false);
	lines.push("");
	return writeLines(configPath(withIni(name)), lines);
}

/** A dump of every loaded config - each section with its entries, as `dump_config` prints them. */
export function dump() {
	const dumped: SectionDump[] = [];
	for (let i = 0; i < sections.length; i++) {
		const lines: string[] = [];
		for (const each of sections[i].entries) dumpEntry(lines, each, 0);
		dumped.push({ heading: `Section ${i}: ${sections[i].name}`, lines });
	}
	return dumped;
}

/**
 * A value by a path, `line` a row of its block. With the key in the section
 * more than once and no line asked for, `index` picks which one - and, as in
 * the original, still picks the value in it.
 */
export function getValueByPath(section: Section, path: string, index = 0, line = 0) {
	return pick(valuesAt(section, path, index, line), index);
}

/** A whole number; 0 when there is none. */
export function getInt(section: Section, key: string, index = 0) {
	const text = getValue(section, key, index);
	return text != null ? toInt(text) : 0;
}

/** A number; 0 when there is none. */
export function getNumber(section: Section, key: string, index = 0) {
	const text = getValue(section, key, index);
	return text != null ? toNumber(text) : 0;
}

/** cfg_get_bool's rule: true for a whole number other than 0, e.g. "1" or "2"; false for anything else, "true" included. */
export function getBoolean(section: Section, key: string, index = 0) {
	return getInt(section, key, index) != 0;
}

/**
 * The words of a key's line - of its `index`-th line when the key is there
 * more than once. For a block, every value of every row. Null when there is
 * no such key or nothing in it.
 */
export function getWords(section: Section, key: string, index = 0) {
	const matches = named(section.entries, key);
	if (index >= matches.length) return null;
	const found = matches[index];

	const list: string[] = [];

	if (found.kind == "block" && found.content == "entries") {
		for (const row of found.rows) {
			if (row.kind == "value") {
				for (const each of row.values) list.push(unquote(each));
			}
		}
	} else if (found.kind == "block") {
		for (const each of found.values) list.push(unquote(each));
	} else if (found.values.length > 0) {
		// The first value, split again: `KEY = "a b" c` gives a and b.
		for (const word of splitValues(found.values[0])) list.push(word);
	}

	return list.length > 0 ? list : null;
}

/** The numbers in the value `index` - "1.0 2.0 3.0" is three; null when there is no value. */
export function getNumbers(section: Section, key: string, index = 0) {
	const text = getValue(section, key, index);
	if (text == null) return null;
	return splitValues(text).map(toNumber);
}

/** Every value of the line a path leads to, quotes and all; [] for an empty line, null for none. */
export function getValues(section: Section, path: string, index = 0, line = 0) {
	const found = valuesAt(section, path, index, line);
	return found != null ? found.slice(0) : null;
}

/** The section's keys, in file order. */
export function keys(section: Section) {
	return section.entries.map(each => each.key);
}

/** Every entry: its key, and its values when it is a line. */
export function entries(section: Section) {
	const list: SectionEntry[] = [];
	for (const each of section.entries) {
		const block = each.kind == "block";
		list.push({ key: each.key, values: block ? [] : each.values.slice(0), block });
	}
	return list;
}

/**
 * The number of values in a line, of rows in a block, or - for a key that is
 * there more than once - of times it is there. A path counts what it leads to.
 */
export function size(section: Section, key: string) {
	const parts = splitPath(key);
	if (parts.length == 0) return 0;
	const matches = named(section.entries, parts[0]);
	if (matches.length == 0) return 0;
	if (parts.length == 1) return matches.length > 1 ? matches.length : sizeOf(matches[0]);
	const found = follow(matches[0].rows, parts.slice(1), 0);
	return found != null ? sizeOf(found.entry) : 0;
}

/** Whether the section has the key. A key with "/" is not a path here. */
export function has(section: Section, key: string) {
	return named(section.entries, key).length > 0;
}

/**
 * Sets a value. A key that is not there is made; a value past the end of its
 * line is added with empty ones before it. For a block, `line` is the row -
 * made, with the rows before it, when missing. A path makes the blocks on its
 * way.
 */
export function set(section: Section, key: string, text: string, index = 0, line = 0) {
	const parts = splitPath(key);
	if (parts.length == 0 || index < 0) return false;
	if (parts.length == 1) return setPlain(section, parts[0], text, index, line);
	return setByPath(section, parts, text, index);
}

/** Sets a whole number; the fraction is dropped: 2.7 is written as 2. */
export function setInt(section: Section, key: string, value: number, index = 0) {
	return set(section, key, `${Math.trunc(value)}`, index);
}

/** Sets a number, written as is: 2.5, not 2.500000. */
export function setNumber(section: Section, key: string, value: number, index = 0) {
	return set(section, key, `${value}`, index);
}

/** Written as 1 or 0. */
export function setBoolean(section: Section, key: string, value: boolean, index = 0) {
	return set(section, key, value ? "1" : "0", index);
}

/** Removes every entry of the key; false when there was none. */
export function remove(section: Section, key: string) {
	const kept = section.entries.filter(each => !sameKey(each.key, key));
	const removed = kept.length != section.entries.length;
	section.entries = kept;
	return removed;
}

/**
 * Makes the key a line of values or a block, emptying it when it changes; a
 * key that is not there is made. Turning it into a block drops the other
 * entries of the key.
 */
export function setKind(section: Section, key: string, kind: EntryKind) {
	const matches = named(section.entries, key);

	if (matches.length == 0) {
		section.entries.push(entry(key, kind, [], null));
		return;
	}

	const target = matches[0];

	if (target.kind != kind) {
		target.values = [];
		target.rows = [];
		target.content = kind == "block" ? "entries" : "strings";
		target.kind = kind;
	}

	if (kind == "block") {
		for (let i = 1; i < matches.length; i++) section.entries.splice(section.entries.indexOf(matches[i]), 1);
	}
}

/** Says what the key holds; between rows and text it is emptied. A key that is not there is made. */
export function setContent(section: Section, key: string, content: ContentKind) {
	const matches = named(section.entries, key);

	if (matches.length == 0) {
		const made = entry(key, "value", [], null);
		made.content = content;
		section.entries.push(made);
		return;
	}

	const target = matches[0];

	if (target.content != content) {
		target.values = [];
		target.rows = [];
	}

	target.content = content;
}

/** The comment written before row `row` of the block `key`; "" removes it. False when there is no such row. */
export function setRowComment(section: Section, key: string, row: number, comment: string) {
	const matches = named(section.entries, key);
	if (matches.length == 0) return false;
	const block = matches[0];
	if (block.kind != "block" || block.content != "entries" || row < 0 || row >= block.rows.length) return false;
	block.rows[row].comments = comment.length > 0 ? [comment] : null;
	return true;
}

/** A config's handle for Pawn plugins: its number among the loaded ones; -1 for none. */
export function configHandle(config: Config) {
	return configs.indexOf(config);
}

/** The config a Pawn plugin's handle stands for; null for none. */
export function configByHandle(handle: number) {
	return handle >= 0 && handle < configs.length ? configs[handle] : null;
}

/** A section's handle for Pawn plugins: its number among every loaded one; -1 for none. */
export function sectionHandle(found: Section) {
	return sections.indexOf(found);
}

/** The section a Pawn plugin's handle stands for; null for none. */
export function sectionByHandle(handle: number) {
	return handle >= 0 && handle < sections.length ? sections[handle] : null;
}

/** A section of that name in any config: the last one loaded. */
export function findSection(name: string) {
	return sections.findLast(each => each.name == name);
}

/** How many sections are loaded, across every config. */
export function sectionCount() {
	return sections.length;
}
