/**
 * Config Core — configs in INI, YAML or JSON for plugins: read into a typed
 * object and written back, or read as a tree of values when the shape is not
 * known beforehand. How to use it: README.md.
 */
import * as fs from "~/fs";
import { ConfigFormat, ConfigKind, ConfigCoreOptions } from "./types";
import { TreeDocument, TreeNode } from "./internal";
import * as tree from "./tree";
import { YamlReader, writeYaml } from "./yaml";
import { JsonReader, writeJson } from "./json";
import { iniTree, writeIni } from "./ini-tree";
import { Config, readSections } from "./ini";
import * as files from "./files";

export * from "./types";

export default defineModule<ConfigCoreOptions>({
	meta: { name: "config-core", configKey: "configs" },
	imports: [{ from: "@amxts/config-core", as: "configs" }],
	defaults: { baseDir: "" },
	setup(options) {
		setBaseDir(options.baseDir);
	},
});

/** Sets the folder under `configs/` that file names are relative to, e.g. `"myserver"`; `""` is `configs/` itself. */
export function setBaseDir(dir: string) {
	files.setBaseDir(dir);
}

/**
 * Reads a config file into an object shaped like `defaults`: each value the
 * file has, where it is of the right kind, and the default for the rest.
 * The file is `configs/<baseDir>/<name>` - YAML, JSON or INI, whichever is
 * there (`resolve()`). A value of the wrong kind, a name not in its union and
 * a key the object does not have are said in the server console with the
 * file, the line and the column. `save()` writes the object back.
 *
 *     const settings = configs.load("settings", {
 *         chat: { prefix: "[HNS]" },
 *         round: { time: 2.5 },
 *     });
 *     settings.round.time = 3;
 *     configs.save(settings);
 */
export function load<T extends object>(name: string, defaults: T): T;
// The build turns every call with defaults into a reader for the object's
// shape (the core's scripts/typed-configs.ts), and save() into one that finds
// the object's file: these bodies are what the compiler sees of the two, and
// are reached only by a call the build could not read.
export function load(name: string) {
	console.error(`[ConfigCore] configs.load("${name}") has no defaults - a config is read into an object: configs.load(name, defaults)`);
	return parse("", "yaml");
}

/**
 * Writes an object `load()` read back into its file, in the file's format:
 * comments on lines of their own stay where they were. `false` when it could
 * not be written, or the object was not read by `load()`.
 */
export function save<T extends object>(settings: T): boolean;
export function save(_settings: ConfigNode) {
	console.error("[ConfigCore] configs.save(): this object was not read by configs.load() - nothing is written");
	return false;
}

/** The extensions a config file has, in the order a name without one looks for them. */
const EXTENSIONS = [".ini", ".yaml", ".yml", ".json", ".jsonc"];

function formatOf(file: string) {
	const lower = file.toLowerCase();
	if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
	if (lower.endsWith(".json") || lower.endsWith(".jsonc")) return "json";
	return "ini";
}

function report(file: string, line: number, column: number, message: string) {
	console.error(`[ConfigCore] ${file.length > 0 ? file : "text"}:${line}:${column}: ${message}`);
}

/** A text read into a tree in its format; what cannot be read is reported with its place, and leaves an empty tree. */
function parseDocument(text: string, format: ConfigFormat, file: string) {
	const clean = tree.normalize(text);
	const document: TreeDocument = { file, format, root: tree.makeNode("object", "", "", { line: 1, column: 1 }), indent: "", tail: null };

	if (format == "ini") {
		const config: Config = { name: file, sections: [] };
		readSections(config, clean);
		document.root = iniTree(config);
		return document;
	}

	if (format == "yaml") {
		const reader = new YamlReader(clean);
		const root = reader.read();
		const place = reader.placeAt(reader.errorAt);
		if (reader.failed) report(file, place.line, place.column, reader.error);
		else document.root = root;
		document.indent = reader.indent;
		document.tail = reader.takeComments();
		return document;
	}

	const reader = new JsonReader(clean);
	const root = reader.read();
	const place = reader.placeAt(reader.errorAt);
	if (reader.failed) report(file, place.line, place.column, reader.error);
	else document.root = root;
	document.indent = reader.indent;
	document.tail = reader.takeComments();
	return document;
}

function writeDocument(document: TreeDocument) {
	if (document.format == "yaml") return writeYaml(document);
	if (document.format == "json") return writeJson(document);
	return writeIni(document);
}

/** A document read, and the ConfigNodes that show its values: one a value, made when it is first asked for. */
interface Loaded {
	document: TreeDocument;
	shown: Map<TreeNode, ConfigNode>;
}

function nodeOf(node: TreeNode, loaded: Loaded) {
	if (loaded.shown.has(node)) return loaded.shown.get(node);
	const made = new ConfigNode(node, loaded);
	loaded.shown.set(node, made);
	return made;
}

function loadedOf(document: TreeDocument) {
	const loaded: Loaded = { document, shown: new Map<TreeNode, ConfigNode>() };
	return nodeOf(document.root, loaded);
}

/**
 * The container a path goes on through: the member there, or a new one made
 * for it - a list when the next part is an item, "[0]", an object otherwise.
 * Null where the path cannot go.
 */
function containerFor(parent: TreeNode, part: string, next: string, format: ConfigFormat) {
	const found = tree.member(parent, part);
	if (found != null) return found.kind == "object" || found.kind == "array" ? found : null;
	const index = tree.itemIndex(part);
	if (parent.kind == "array" ? index != parent.items.length : index >= 0) return null;
	const made = tree.makeNode(tree.itemIndex(next) >= 0 ? "array" : "object", parent.kind == "object" ? part : "", "", tree.nowhere());
	made.foldCase = format == "ini" && made.kind == "object";
	parent.items.push(made);
	return made;
}

/** Puts a value at a member or an item, in the place and with the comments of the one it replaces. */
function putNode(parent: TreeNode, part: string, made: TreeNode) {
	let index = -1;
	if (parent.kind == "object" && tree.itemIndex(part) < 0) index = tree.memberIndex(parent, part);
	else if (parent.kind == "array" && tree.itemIndex(part) >= 0) index = tree.itemIndex(part);
	else return false;

	if (index >= 0 && index < parent.items.length) {
		const old = parent.items[index];
		made.key = old.key;
		made.comments = old.comments;
		made.block = old.block;
		made.line = old.line;
		made.column = old.column;
		parent.items[index] = made;
		return true;
	}

	if (parent.kind == "array" && index != parent.items.length) return false;
	made.key = parent.kind == "object" ? part : "";
	parent.items.push(made);
	return true;
}

/**
 * A value of a config file: an object, an array, text, a number, a boolean
 * or `null`, with the place it was read from. `read()` gives the file's top
 * value; a path leads into it: `"chat.prefix"`, `"items[0].name"`. For a file
 * whose shape is not known beforehand; a config of a known shape is read
 * into an object by `load(name, defaults)`.
 *
 *     const maps = configs.read("maps");
 *     for (const map of maps.values()) if (map.getBoolean("enabled")) console.log(map.key);
 */
export class ConfigNode {
	/** The value's kind, one of `"object"`, `"array"`, `"string"`, `"number"`, `"boolean"` or `"null"`. */
	readonly kind: ConfigKind;
	/** The value's key in its object, e.g. `"prefix"`; `""` for an item of an array and for the top value. */
	readonly key: string;
	/** The path of the file the value was read from, e.g. `"addons/amxmodx/configs/settings.yaml"`; `""` for a text given to `parse()`. */
	readonly file: string;
	/** The file's format, one of `"ini"`, `"yaml"` or `"json"`. */
	readonly format: ConfigFormat;
	/** The line the value - or its key - was read from, from `1`; `0` for a value set at run time. */
	readonly line: number;
	/** The column the value - or its key - starts at, from `1`; `0` for a value set at run time and in an INI file. */
	readonly column: number;

	constructor(private node: TreeNode, private loaded: Loaded) {
		this.kind = node.kind;
		this.key = node.key;
		this.file = loaded.document.file;
		this.format = loaded.document.format;
		this.line = node.line;
		this.column = node.column;
	}

	/** The value a path leads to, e.g. `"chat.prefix"` or `"items[0]"`; `null` when there is none. */
	get(path: string) {
		const found = tree.follow(this.node, path);
		return found != null ? nodeOf(found, this.loaded) : null;
	}

	/** Whether a path leads to a value, `null` among them. */
	has(path: string) {
		return tree.follow(this.node, path) != null;
	}

	/** The keys of an object, in file order - of this one, or of the one a path leads to; [] for anything else. */
	keys(path?: string) {
		const found = tree.follow(this.node, path ?? "");
		const keys: string[] = [];
		if (found != null && found.kind == "object") found.items.forEach(each => keys.push(each.key));
		return keys;
	}

	/** The items of an array or the values of an object, in file order - of this one, or of the one a path leads to; [] for anything else. */
	values(path?: string) {
		const found = tree.follow(this.node, path ?? "");
		const values: ConfigNode[] = [];
		if (found == null || (found.kind != "object" && found.kind != "array")) return values;
		for (const each of found.items) values.push(nodeOf(each, this.loaded));
		return values;
	}

	/** A value as text: text as it is, a number as written, `"true"` or `"false"`; `fallback` (or `""`) for none, `null`, an object or an array. */
	getString(path?: string, fallback?: string) {
		return tree.scalarText(tree.follow(this.node, path ?? "")) ?? fallback ?? "";
	}

	/** A value as a number: a number, or text that is one, e.g. `"2.5"`; `fallback` for anything else. */
	getNumber(path?: string, fallback = 0) {
		const value = tree.numberOf(tree.follow(this.node, path ?? ""));
		return isNaN(value) ? fallback : value;
	}

	/** A value as a boolean: `true` or `false`, a number (`0` is `false`), or text - `"yes"`, `"no"`, `"on"`, `"off"`, `"true"`, `"false"` in any case, or a number; `fallback` for anything else. */
	getBoolean(path?: string, fallback = false) {
		const value = tree.booleanOf(tree.follow(this.node, path ?? ""));
		return value < 0 ? fallback : value == 1;
	}

	/** A list of text: the text of each item of an array, or one value as a list of one; [] for none. */
	getStrings(path?: string) {
		const found = tree.follow(this.node, path ?? "");
		const list: string[] = [];
		if (found == null) return list;
		if (tree.isScalar(found)) list.push(found.text);
		if (found.kind == "array") found.items.filter(tree.isScalar).forEach(item => list.push(item.text));
		return list;
	}

	/** Sets text at a path, making the objects - and the lists, before an item `"[0]"` - on the way; `false` where the path goes through a value that is not an object or a list. */
	set(path: string, value: string) {
		return this.put(path, tree.makeNode("string", "", value, tree.nowhere()));
	}

	/** Sets a number at a path, as `set()` sets text. */
	setNumber(path: string, value: number) {
		return this.put(path, tree.numberNode("", value, tree.nowhere()));
	}

	/** Sets a boolean at a path, as `set()` sets text. */
	setBoolean(path: string, value: boolean) {
		return this.put(path, tree.makeNode("boolean", "", value ? "true" : "false", tree.nowhere()));
	}

	/** Sets a list of text at a path, as `set()` sets text. */
	setStrings(path: string, values: string[]) {
		const list = tree.makeNode("array", "", "", tree.nowhere());
		for (const value of values) list.items.push(tree.makeNode("string", "", value, tree.nowhere()));
		return this.put(path, list);
	}

	/** Removes the value a path leads to; `false` when there was none. */
	remove(path: string) {
		const parts = tree.pathParts(path);
		if (parts.length == 0) return false;
		const parent = tree.follow(this.node, parts.slice(0, -1).join("."));
		const last = parts[parts.length - 1];
		if (parent == null) return false;
		let index = -1;
		if (parent.kind == "object" && tree.itemIndex(last) < 0) index = tree.memberIndex(parent, last);
		else if (parent.kind == "array") index = tree.itemIndex(last);
		if (index < 0 || index >= parent.items.length) return false;
		parent.items.splice(index, 1);
		return true;
	}

	/** Writes the whole file back in its format, with the comments that were on lines of their own. `false` for a text given to `parse()`. */
	save() {
		const document = this.loaded.document;
		if (document.file.length == 0) return false;
		return files.writeLines(document.file, writeDocument(document));
	}

	private put(path: string, made: TreeNode) {
		const parts = tree.pathParts(path);
		if (parts.length == 0) return false;
		let parent = this.node;
		for (let i = 0; i < parts.length - 1; i++) {
			const next = containerFor(parent, parts[i], parts[i + 1], this.loaded.document.format);
			if (next == null) return false;
			parent = next;
		}
		return putNode(parent, parts[parts.length - 1], made);
	}
}

/**
 * The file a name is read from by `read()`: the name, when it ends in `.ini`,
 * `.yaml`, `.yml`, `.json` or `.jsonc`; else the first of `name.ini`, `name.yaml`,
 * `name.yml`, `name.json` and `name.jsonc` that is there - two of them are an
 * error in the server console - and `name.yaml` when none is.
 */
export function resolve(name: string) {
	const file = name.trim();
	if (EXTENSIONS.some(extension => file.toLowerCase().endsWith(extension))) return file;
	const found = EXTENSIONS.map(extension => `${file}${extension}`).filter(each => fs.existsSync(files.configPath(each)));
	if (found.length > 1) console.error(`[ConfigCore] ${files.configPath(file)}: ${found.join(", ")} are all there - ${found[0]} is read; keep one of them`);
	return found.length > 0 ? found[0] : `${file}.yaml`;
}

/**
 * Reads a config file from `configs/<baseDir>/` - INI, YAML or JSON - as a
 * tree of values. A name without an extension finds the file (`resolve()`).
 * A file that is not there reads as an empty object, to be filled and saved;
 * one that cannot be read is reported in the server console with the line
 * and the column, and reads as an empty object too. For a file whose shape
 * is not known beforehand; a config of a known shape is read into an object
 * by `load(name, defaults)`.
 *
 *     const maps = configs.read("maps");     // maps.ini, .yaml, .yml, .json or .jsonc
 *     for (const key of maps.keys()) console.log(key);
 */
export function read(name: string) {
	const file = resolve(name);
	const path = files.configPath(file);
	const text = fs.readFileSync(path);
	return loadedOf(parseDocument(text ?? "", formatOf(file), path));
}

/** Reads a text in a format - `"ini"`, `"yaml"` or `"json"` - as `read()` reads a file; `save()` has no file to write it to. */
export function parse(text: string, format: ConfigFormat) {
	return loadedOf(parseDocument(text, format, ""));
}
