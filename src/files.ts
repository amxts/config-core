/**
 * Where Config Core's files are: the folder under configs/ that names are
 * relative to, and writing lines to a file. Not part of the API.
 */
import * as fs from "~/fs";
import { EOL } from "~/os";
import { server } from "~/facade";

let baseDir = "";

/** Sets the folder under configs/ that names are relative to, e.g. "myserver"; "" is configs/ itself. */
export function setBaseDir(dir: string) {
	baseDir = dir.trim();
}

/** A file's path: under configs/ and the base folder. */
export function configPath(file: string) {
	const folder = baseDir.length > 0 ? `${server.configsDir}/${baseDir}` : server.configsDir;
	return `${folder}/${file}`;
}

/** Lines to a file, its folder made when missing, each ended as this system ends them. */
export function writeLines(path: string, lines: string[]) {
	const slash = path.lastIndexOf("/");
	if (slash > 0) fs.mkdirSync(path.slice(0, slash), { recursive: true });
	return fs.writeFileSync(path, lines.join(EOL) + EOL);
}
