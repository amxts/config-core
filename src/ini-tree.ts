/**
 * An INI file as Config Core's tree - its sections an object of objects - and
 * the tree written back as INI. Not part of the API.
 */
import { Config, Entry, Section } from "./ini";
import { Place, TreeDocument, TreeNode } from "./internal";
import { isScalar, makeNode, memberIndex, writeComments } from "./tree";

/** The line of an INI entry; its column is not kept. */
function placeOfLine(line: number) {
	const place: Place = { line, column: 0 };
	return place;
}

/** A line of values: none is null, one is text, several are a list of text. */
function valuesNode(values: string[], line: number) {
	if (values.length == 0) return makeNode("null", "", "", placeOfLine(line));
	if (values.length == 1) return makeNode("string", "", values[0], placeOfLine(line));
	const list = makeNode("array", "", "", placeOfLine(line));
	for (const value of values) list.items.push(makeNode("string", "", value, placeOfLine(line)));
	return list;
}

/** A block of `key = value` lines is an object; a block with rows is a list of them. */
function blockNode(entry: Entry) {
	if (entry.content == "strings") return valuesNode(entry.values, entry.line);
	const keyed = entry.rows.every(row => row.key.length > 0);
	const node = makeNode(keyed ? "object" : "array", "", "", placeOfLine(entry.line));
	node.foldCase = keyed;
	node.block = !keyed;

	for (const row of entry.rows) {
		if (keyed && memberIndex(node, row.key) >= 0) continue;
		const made = row.key.length > 0 && !keyed ? keyedRow(row) : entryNode(row);
		node.items.push(made);
	}

	return node;
}

/** A `key = value` line among rows: an object with that one member. */
function keyedRow(row: Entry) {
	const node = makeNode("object", "", "", placeOfLine(row.line));
	node.foldCase = true;
	node.items.push(entryNode(row));
	node.comments = row.comments;
	return node;
}

function entryNode(entry: Entry) {
	const node = entry.kind == "block" ? blockNode(entry) : valuesNode(entry.values, entry.line);
	node.key = entry.key;
	node.comments = entry.comments;
	return node;
}

function sectionNode(section: Section) {
	const node = makeNode("object", section.name, "", placeOfLine(section.line));
	node.foldCase = true;
	node.comments = section.comments;

	for (const entry of section.entries) {
		// The first of a key found twice is the one read, as cfg_get_value reads it.
		if (memberIndex(node, entry.key) < 0) node.items.push(entryNode(entry));
	}

	return node;
}

/** The sections as an object; a name found twice is the last section of that name, as cfg_get_section finds it. */
export function iniTree(config: Config) {
	const root = makeNode("object", "", "", { line: 1, column: 0 });
	for (const section of config.sections) {
		const node = sectionNode(section);
		const known = memberIndex(root, section.name);
		if (known >= 0) root.items[known] = node;
		else root.items.push(node);
	}
	return root;
}

/** A value as INI writes it: in quotes when it has a space in it, or nothing in it. */
function iniValue(node: TreeNode) {
	if (node.kind == "boolean") return node.text == "true" ? "1" : "0";
	const text = node.kind == "number" && node.text.length == 0 ? `${node.value}` : node.text;
	return text.length == 0 || text.includes(" ") || text.includes("\t") ? `"${text}"` : text;
}

/** A row of a block of rows: "value" "value" - or the lines of a `key = value` row. */
function writeRow(lines: string[], row: TreeNode, level: number) {
	const pad = "\t".repeat(level);
	writeComments(lines, row.comments, pad);

	if (row.kind == "object") {
		for (const each of row.items) writeEntry(lines, each, level);
		return;
	}

	const values = (row.kind == "array" ? row.items : [row]).filter(isScalar);
	lines.push(`${pad}${values.map(each => `"${iniValue(each).replaceAll("\"", "")}"`).join(" ")}`);
}

function writeEntry(lines: string[], entry: TreeNode, level: number) {
	const pad = "\t".repeat(level);
	writeComments(lines, entry.comments, pad);

	if (entry.kind == "null") {
		lines.push(`${pad}${entry.key} =`);
		return;
	}

	if (isScalar(entry)) {
		lines.push(`${pad}${entry.key} = ${iniValue(entry)}`);
		return;
	}

	if (entry.kind == "array" && !entry.block && entry.items.every(isScalar)) {
		lines.push(`${pad}${entry.key} = ${entry.items.map(iniValue).join(" ")}`);
		return;
	}

	lines.push(`${pad}${entry.key} = {`);
	if (entry.kind == "object") {
		for (const each of entry.items) writeEntry(lines, each, level + 1);
	} else {
		for (const row of entry.items) writeRow(lines, row, level + 1);
	}
	lines.push(`${pad}}`);
}

/** The document as INI lines: each member of the top an [section], what is not an object left out. */
export function writeIni(document: TreeDocument) {
	const lines: string[] = [];
	for (const section of document.root.items) {
		if (section.kind != "object") continue;
		// A section made at run time gets a blank line before it, as save() gives one.
		if (section.line == 0 && lines.length > 0) lines.push("");
		writeComments(lines, section.comments, "");
		lines.push(`[${section.key}]`);
		for (const each of section.items) writeEntry(lines, each, 0);
	}
	writeComments(lines, document.tail, "");
	return lines;
}
