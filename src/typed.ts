/**
 * Config Core's typed configs: what the build writes for each
 * `configs.load(name, defaults)` calls to read a file into the object, to
 * check what the file says, and to write the object back on
 * `configs.save(settings)`. Not part of the API.
 *
 * It goes through the public ConfigNode only, so it runs the same in the
 * plugin that owns the module and in any other: there each call crosses to
 * the owner. It is compiled into every plugin that loads a typed config, and
 * the objects it read are remembered here, in that plugin.
 */
import { ConfigKind } from "./types";
import { ConfigNode, read } from "./index";
import { booleanText } from "./tree";

/** An object `load()` read: the file's top value, and how to put the object back into it. */
interface Tracked {
	root: ConfigNode;
	write: () => void;
}

const tracked = new Map<object, Tracked>();

/** Where a value is: "configs/settings.yaml:12:9" - without the column where the file does not keep it (INI). */
function whereOf(node: ConfigNode) {
	if (node.line == 0) return node.file;
	return node.column > 0 ? `${node.file}:${node.line}:${node.column}` : `${node.file}:${node.line}`;
}

function warn(node: ConfigNode, message: string) {
	console.warn(`[ConfigCore] ${whereOf(node)}: ${message}`);
}

/** How many letters to add, remove, change or swap to turn one word into the other, case aside. */
function distance(a: string, b: string) {
	const x = a.toLowerCase().split("");
	const y = b.toLowerCase().split("");
	let before: number[] = [];
	let previous: number[] = [];
	for (let j = 0; j <= y.length; j++) previous.push(j);
	for (let i = 1; i <= x.length; i++) {
		const current = [i];
		for (let j = 1; j <= y.length; j++) {
			const cost = x[i - 1] == y[j - 1] ? 0 : 1;
			let best = Math.min(Math.min(previous[j] + 1, current[j - 1] + 1), previous[j - 1] + cost);
			const swapped = i > 1 && j > 1 && x[i - 1] == y[j - 2] && x[i - 2] == y[j - 1];
			if (swapped) best = Math.min(best, before[j - 2] + 1);
			current.push(best);
		}
		before = previous;
		previous = current;
	}
	return previous[y.length];
}

/** ` - did you mean "name"?` for the known name a slip away from `name`; "" when none is that close. */
function suggestion(name: string, known: string[]) {
	let best = "";
	let bestDistance = Infinity;
	for (const each of known) {
		const away = distance(name, each);
		if (away >= bestDistance) continue;
		best = each;
		bestDistance = away;
	}
	const limit = name.length <= 4 ? 1 : Math.max(2, Math.floor(name.length / 4));
	return bestDistance <= limit ? ` - did you mean "${best}"?` : "";
}

/** "a list", "true or false", ... - a value's kind as a message says it. */
function kindWords(kind: ConfigKind) {
	if (kind == "object") return "an object";
	if (kind == "array") return "a list";
	if (kind == "boolean") return "true or false";
	if (kind == "number") return "a number";
	if (kind == "string") return "text";
	return "empty";
}

/** What a kind asks for, as a message says it. */
function wantWords(kind: string) {
	if (kind == "number" || kind == "numbers") return "a number";
	if (kind == "boolean" || kind == "booleans") return "true or false";
	return "text";
}

/** How a value is named in a message: "prefix" - or, an item of a list, "the item". */
function nameOf(node: ConfigNode) {
	return node.key.length > 0 ? `"${node.key}"` : "the item";
}

/** What becomes of a value that is not what it should be: a field keeps its default, an item of a list is left out. */
function outcome(node: ConfigNode) {
	return node.key.length > 0 ? "the default stays" : "it is left out";
}

function isScalar(node: ConfigNode) {
	return node.kind == "string" || node.kind == "number" || node.kind == "boolean";
}

function numberOf(node: ConfigNode) {
	if (node.kind == "number") return node.getNumber();
	if (node.kind != "string") return NaN;
	const text = node.getString().trim();
	return text.length > 0 ? parseFloat(text) : NaN;
}

/** 1 true, 0 false, -1 neither: true or false, a number (0 is false), or text as the tree reads it (`booleanText()`). */
function booleanOf(node: ConfigNode) {
	if (node.kind == "boolean") return node.getBoolean() ? 1 : 0;
	if (node.kind == "number") return node.getNumber() != 0 ? 1 : 0;
	return node.kind == "string" ? booleanText(node.getString()) : -1;
}

/** Whether a value is of the kind a scalar `kind` - or a list's - asks for; a name is one of `known`. */
function isKind(node: ConfigNode, kind: string, known: string[]) {
	if (kind == "text" || kind == "texts") return isScalar(node);
	if (kind == "number" || kind == "numbers") return !isNaN(numberOf(node));
	if (kind == "boolean" || kind == "booleans") return booleanOf(node) >= 0;
	return isScalar(node) && known.includes(node.getString());
}

/** Whether one value - a scalar, or an item of a list - is what `kind` asks for; says so when it is not. */
function fits(node: ConfigNode, kind: string, known: string[]) {
	if (isKind(node, kind, known)) return true;

	if ((kind == "name" || kind == "names") && isScalar(node)) {
		const text = node.getString();
		const listed = known.map(name => `"${name}"`).join(", ");
		warn(node, `${nameOf(node)} is "${text}", not one of ${listed}${suggestion(text, known)} - ${outcome(node)}`);
		return false;
	}

	const what = isScalar(node) ? `${kindWords(node.kind)} ("${node.getString()}")` : kindWords(node.kind);
	warn(node, `${nameOf(node)} is ${what}, not ${wantWords(kind)} - ${outcome(node)}`);
	return false;
}

/** What an INI file has no place for, said once a file and a path. */
const reported = new Set<string>();

function reportOnce(root: ConfigNode, path: string, why: string) {
	const key = `${root.file}|${path}`;
	if (reported.has(key)) return;
	reported.add(key);
	console.warn(`[ConfigCore] ${root.file}: "${path}" cannot be in an INI file, ${why} - it stays the default; write the config in YAML or JSON`);
}

/**
 * Reads a config file for `load()`. An INI file holds [sections] of values:
 * `outside` are the object's values that are not in a section - not objects
 * at its top - and `objectLists` its lists of objects, which INI has none of.
 * In an INI file each of them stays its default, and the console says so.
 */
export function open(name: string, outside: string[], objectLists: string[]) {
	const root = read(name);
	if (root.format != "ini") return root;
	for (const path of outside) reportOnce(root, path, "whose values are in [sections]");
	for (const path of objectLists) reportOnce(root, path, "which has no lists of objects");
	return root;
}

/** A member of an object, or null - found as the file finds keys: an INI section's in any case. */
export function member(parent: ConfigNode | null, key: string) {
	if (parent == null || parent.kind != "object") return null;
	return parent.get(key);
}

/**
 * An object, its keys checked against `known`: a key it does not know is
 * said with the nearest known one. Null when it is not there, empty, or not
 * an object - said when it is something else.
 */
export function objectOf(node: ConfigNode | null, known: string[]) {
	if (node == null || node.kind == "null") return null;

	if (node.kind != "object") {
		warn(node, `${nameOf(node)} is ${kindWords(node.kind)}, not an object - the defaults stay`);
		return null;
	}

	const found = known.map(key => node.get(key));
	const inside = node.key.length > 0 ? ` in "${node.key}"` : "";
	for (const child of node.values()) {
		if (!found.includes(child)) warn(child, `unknown key "${child.key}"${inside}${suggestion(child.key, known)}`);
	}
	return node;
}

/** An object's values, for a Map: null when it is not there, empty or not an object - said when it is something else. */
export function entries(node: ConfigNode | null) {
	if (node == null || node.kind == "null") return null;
	if (node.kind == "object") return node.values();
	warn(node, `${nameOf(node)} is ${kindWords(node.kind)}, not an object - the default stays`);
	return null;
}

/** Says which of `keys` an object made from the file leaves out: they take an empty value. */
export function need(node: ConfigNode, keys: string[]) {
	for (const key of keys) {
		const found = member(node, key);
		if (found == null || found.kind == "null") warn(node, `"${key}" is missing - it is left empty`);
	}
}

/**
 * Whether a value is there and is what `kind` asks for: "text", "number",
 * "boolean", "name" (one of `known`), or a list of them - "texts",
 * "numbers", "booleans", "names". A value of another kind is said, and the
 * default stays. Empty (null) is the default too, but in an INI file, where
 * `key =` is empty text or an empty list.
 */
export function is(node: ConfigNode | null, kind: string, known: string[] = []) {
	if (node == null) return false;

	if (node.kind == "null") {
		if (node.format != "ini") return false;
		return kind == "text" || kind == "texts" || kind == "numbers" || kind == "booleans" || kind == "names";
	}

	const list = kind == "texts" || kind == "numbers" || kind == "booleans" || kind == "names";
	if (!list) return fits(node, kind, known);
	if (node.kind == "array" || isScalar(node)) return true;
	warn(node, `${nameOf(node)} is ${kindWords(node.kind)}, not a list - the default stays`);
	return false;
}

/** A value as text: a number as written, "true" or "false"; "" for empty. */
export function asText(node: ConfigNode | null) {
	return node != null ? node.getString() : "";
}

export function asNumber(node: ConfigNode | null) {
	return node != null ? numberOf(node) : 0;
}

export function asBoolean(node: ConfigNode | null) {
	return node != null && booleanOf(node) == 1;
}

/** A list's items, or one value as a list of one; an item that is not `kind` is said and left out. */
function listItems(node: ConfigNode | null, kind: string, known: string[]) {
	let items: ConfigNode[] = [];
	if (node != null && node.kind == "array") items = node.values();
	else if (node != null && node.kind != "null") items = [node];
	return items.filter(item => fits(item, kind, known));
}

export function asTexts(node: ConfigNode | null) {
	return listItems(node, "texts", []).map(item => item.getString());
}

export function asNames(node: ConfigNode | null, known: string[]) {
	return listItems(node, "names", known).map(item => item.getString());
}

export function asNumbers(node: ConfigNode | null) {
	return listItems(node, "numbers", []).map(numberOf);
}

export function asBooleans(node: ConfigNode | null) {
	return listItems(node, "booleans", []).map(item => booleanOf(item) == 1);
}

/**
 * A list of lists - rows of values: its items, each a list or one value (a
 * list of one); another item is said and left out. Null when it is not there
 * or not a list - said when it is something else. In an INI file an empty
 * value or an empty block is an empty list.
 */
export function lists(node: ConfigNode | null) {
	if (node == null) return null;
	const none: ConfigNode[] = [];
	const empty = node.kind == "null" || (node.kind == "object" && node.keys().length == 0);
	if (empty && node.format == "ini") return none;
	if (node.kind == "null") return null;

	if (node.kind != "array") {
		warn(node, `${nameOf(node)} is ${kindWords(node.kind)}, not a list - the default stays`);
		return null;
	}

	return node.values().filter((item) => {
		if (item.kind == "array" || isScalar(item)) return true;
		warn(item, `the item is ${kindWords(item.kind)}, not a list - it is left out`);
		return false;
	});
}

/** A list of objects: its items that are objects - another item is said and left out. Null when it is not there or not a list. */
export function items(node: ConfigNode | null) {
	if (node == null || node.kind == "null") return null;

	if (node.kind != "array") {
		warn(node, `${nameOf(node)} is ${kindWords(node.kind)}, not a list - the default stays`);
		return null;
	}

	return node.values().filter((item) => {
		if (item.kind == "object") return true;
		warn(item, `the item is ${kindWords(item.kind)}, not an object - it is left out`);
		return false;
	});
}

// A value is written only where it changed: one the file has already stays
// as the file writes it - quoted or not, "2.50", a list in [ ].

/** Writes text at a path, unless the file has it there already. */
export function putText(root: ConfigNode, path: string, value: string) {
	const found = root.get(path);
	if (found != null && isScalar(found) && found.getString() == value) return;
	root.set(path, value);
}

/** Writes a number at a path, unless the file has it there already. */
export function putNumber(root: ConfigNode, path: string, value: number) {
	const found = root.get(path);
	if (found != null && numberOf(found) == value) return;
	root.setNumber(path, value);
}

/** Writes a boolean at a path, unless the file has it there already. */
export function putBoolean(root: ConfigNode, path: string, value: boolean) {
	const found = root.get(path);
	if (found != null && booleanOf(found) == (value ? 1 : 0)) return;
	root.setBoolean(path, value);
}

/** The items of the list at a path, when it is a list of scalars as long as `count`; null otherwise. */
function sameLength(root: ConfigNode, path: string, count: number) {
	const found = root.get(path);
	if (found == null || found.kind != "array") return null;
	const items = found.values();
	return items.length == count && items.every(isScalar) ? items : null;
}

/** Writes a list of text at a path, unless the file has that list there already. */
export function putTexts(root: ConfigNode, path: string, values: string[]) {
	const items = sameLength(root, path, values.length);
	if (items != null && items.every((item, index) => item.getString() == values[index])) return;
	root.setStrings(path, values);
}

/** Writes a list of numbers at a path, unless the file has that list there already. */
export function putNumbers(root: ConfigNode, path: string, values: number[]) {
	const items = sameLength(root, path, values.length);
	if (items != null && items.every((item, index) => numberOf(item) == values[index])) return;
	root.setStrings(path, []);
	values.forEach((value, index) => root.setNumber(`${path}[${index}]`, value));
}

/** Writes a list of booleans at a path, unless the file has that list there already. */
export function putBooleans(root: ConfigNode, path: string, values: boolean[]) {
	const items = sameLength(root, path, values.length);
	if (items != null && items.every((item, index) => booleanOf(item) == (values[index] ? 1 : 0))) return;
	root.setStrings(path, []);
	values.forEach((value, index) => root.setBoolean(`${path}[${index}]`, value));
}

/**
 * Makes the value at a path a list of `count` items, the ones past the end
 * removed, so that each row can then be written at `path[i]`: a list of lists.
 */
export function resizeLists(root: ConfigNode, path: string, count: number) {
	const found = root.get(path);
	if (found == null || found.kind != "array") root.setStrings(path, []);
	for (let index = root.values(path).length - 1; index >= count; index--) root.remove(`${path}[${index}]`);
}

/**
 * Makes the value at a path a list of `count` objects, keeping the objects
 * it already has - their comments with them - so that each field can then
 * be set at `path[i].field`. An item that is not an object was left out when
 * the list was read, and is left out of the file too.
 */
export function resize(root: ConfigNode, path: string, count: number) {
	const found = root.get(path);
	if (found == null || found.kind != "array") root.setStrings(path, []);

	const items = root.values(path);
	for (let index = items.length - 1; index >= 0; index--) {
		if (items[index].kind != "object") root.remove(`${path}[${index}]`);
	}

	for (let index = root.values(path).length - 1; index >= count; index--) root.remove(`${path}[${index}]`);

	for (let index = root.values(path).length; index < count; index++) {
		// An item is made by the first value set in it; one set and removed leaves it empty.
		root.set(`${path}[${index}].__`, "");
		root.remove(`${path}[${index}].__`);
	}
}

/** Leaves only these keys in the object at a path - a Map's, before its entries are written. */
export function keep(root: ConfigNode, path: string, keys: string[]) {
	const found = root.get(path);
	if (found != null && found.kind != "object") root.remove(path);
	for (const key of root.keys(path)) {
		if (!keys.includes(key)) root.remove(`${path}.${key}`);
	}
}

/** Remembers an object `load()` read, and how `save()` writes it back. */
export function track(value: object, root: ConfigNode, write: () => void) {
	tracked.set(value, { root, write });
}

/** Writes an object `load()` read back into its file, in the file's format. */
export function save(value: object) {
	if (!tracked.has(value)) {
		console.error("[ConfigCore] configs.save(): this object was not read by configs.load() - nothing is written");
		return false;
	}

	const found = tracked.get(value);
	found.write();
	return found.root.save();
}
