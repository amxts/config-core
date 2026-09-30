import { ConfigNode } from "@amxts/config-core";

plugin({ name: "Dump", version: "1.0.0", author: "you", description: "A config as a tree, a line a value: the module's tests read it" });

/** A config file as a tree: each value's path, kind, text and place, a line each. */
export function config_dump(name: string) {
	const lines: string[] = [];
	dump(configs.read(name), "", lines);
	return lines.join("\n");
}

/** A text read in a format - "yaml", "json" or "ini" - as config_dump() shows a file. */
export function config_parse(text: string, format: string) {
	const lines: string[] = [];
	dump(parsed(text, format), "", lines);
	return lines.join("\n");
}

/** A value read every way there is: text, number, boolean, list, whether it is there, and its keys - with "|" between. */
export function config_get(name: string, path: string) {
	const config = configs.read(name);
	return [
		config.getString(path, "-"),
		`${config.getNumber(path, -1)}`,
		`${config.getBoolean(path)}/${config.getBoolean(path, true)}`,
		config.getStrings(path).join(","),
		`${config.has(path)}`,
		config.keys(path).join(","),
		`${config.values(path).length}`,
	].join("|");
}

/**
 * Changes a config file and saves it: a line an edit - "path=text",
 * "path=#number", "path=?boolean", "path=[a,b]" for a list, "-path" to
 * remove. The answers, 1 or 0 an edit, then the save's.
 */
export function config_edit(name: string, edits: string) {
	const config = configs.read(name);
	const done: string[] = [];
	for (const edit of edits.split("\n")) done.push(apply(config, edit) ? "1" : "0");
	done.push(config.save() ? "1" : "0");
	return done.join("");
}

function parsed(text: string, format: string) {
	if (format == "yaml") return configs.parse(text, "yaml");
	if (format == "json") return configs.parse(text, "json");
	return configs.parse(text, "ini");
}

function apply(config: ConfigNode, edit: string) {
	if (edit.startsWith("-")) return config.remove(edit.slice(1));
	const equals = edit.indexOf("=");
	const path = edit.slice(0, equals);
	const value = edit.slice(equals + 1);
	if (value.startsWith("#")) return config.setNumber(path, parseFloat(value.slice(1)));
	if (value.startsWith("?")) return config.setBoolean(path, value == "?true");
	if (value.startsWith("[")) return config.setStrings(path, value.slice(1, -1).split(","));
	return config.set(path, value);
}

function dump(node: ConfigNode, path: string, lines: string[]) {
	const place = `@${node.line}:${node.column}`;

	if (node.kind != "object" && node.kind != "array") {
		lines.push(`${path} ${node.kind} ${node.getString().replaceAll("\n", "\\n")} ${place}`);
		return;
	}

	lines.push(`${path} ${node.kind} ${place}`);
	const values = node.values();
	for (let i = 0; i < values.length; i++) dump(values[i], node.kind == "array" ? `${path}[${i}]` : `${path}.${values[i].key}`, lines);
}
