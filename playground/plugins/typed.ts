plugin({ name: "Typed", version: "1.0.0", author: "you", description: "Configs read into typed objects: the module's tests read them" });

type Mode = "normal" | "dm" | "knife";

interface Item {
	name: string;
	price: number;
	tags: string[];
	sale?: number;
}

interface Small {
	chat: { prefix: string };
	maps: string[];
}

interface Settings {
	chat: { prefix: string; colors: boolean };
	round: { time: number; mode: Mode; modes: Mode[] };
	maps: string[];
	weights: number[];
	flags: boolean[];
	shop: { items: Item[] };
	prices: Map<string, number>;
	motd?: string;
	limit?: number;
	hidden?: boolean;
	extra?: { note: string; level?: number };
}

/** A config of every kind of value, as lines of `path=value`; `?` for a field left out. */
export function typed_read(name: string) {
	return dumpSettings(read(name));
}

/**
 * Loads a config, changes it and saves it: a line an edit, "path=value" -
 * chat.prefix, round.time, round.mode, maps (a,b), items (name:price,...),
 * motd ("-" leaves it out), prices (key:value,...), extra.note ("-" leaves
 * extra out). The save's answer, then the object as typed_read() shows it.
 */
export function typed_edit(name: string, edits: string) {
	const settings = read(name);
	for (const edit of edits.split("\n")) apply(settings, edit);
	const saved = configs.save(settings);
	return `${saved}\n${dumpSettings(settings)}`;
}

/** The shape from the defaults' literal, with no type: form A. */
export function typed_simple(name: string) {
	const simple = configs.load(name, {
		chat: { prefix: "[HNS]" },
		round: { time: 2.5, mode: "normal" as Mode },
		maps: ["de_dust2"],
		team: { size: 5, bots: false, list: [{ nick: "a", skill: 1 }] },
	});
	const list = simple.team.list.map(one => `${one.nick}:${one.skill}`).join(",");
	return `${simple.chat.prefix}|${simple.round.time}|${simple.round.mode}|${simple.maps.join(",")}|${simple.team.size}|${simple.team.bots}|${list}`;
}

/** Two loads of one object: the defaults are copied, not changed. */
export function typed_defaults_kept(name: string) {
	const defaults: Small = { chat: { prefix: "[D]" }, maps: ["a"] };
	const first = configs.load(name, defaults);
	first.chat.prefix = "[changed]";
	first.maps.push("b");
	return `${defaults.chat.prefix}|${defaults.maps.join(",")}`;
}

/**
 * Rows of values - a list of lists - and a list whose items are rows of one
 * value: read, a row added when `row` is not "", saved. The save's answer,
 * then the rows as `a,b;c`, then the list.
 */
export function typed_rows(name: string, row: string) {
	const settings = configs.load(name, {
		main: { cvars: [["ID", "value"]], maps: ["de_dust2"] },
	});
	if (row.length > 0) settings.main.cvars.push(row.split(","));
	const saved = row.length > 0 ? configs.save(settings) : false;
	return `${saved}|${settings.main.cvars.map(each => each.join(",")).join(";")}|${settings.main.maps.join(",")}`;
}

/** save() of an object load() did not read. */
export function typed_save_foreign() {
	const settings: Small = { chat: { prefix: "x" }, maps: [] };
	return configs.save(settings);
}

function read(name: string) {
	return configs.load<Settings>(name, {
		chat: { prefix: "[HNS]", colors: true },
		round: { time: 2.5, mode: "normal", modes: ["normal"] },
		maps: ["de_dust2"],
		weights: [1, 2],
		flags: [true],
		shop: { items: [{ name: "knife", price: 0, tags: [] }] },
		prices: new Map<string, number>(),
		motd: "Welcome",
	});
}

function apply(settings: Settings, edit: string) {
	const equals = edit.indexOf("=");
	const path = edit.slice(0, equals);
	const value = edit.slice(equals + 1);
	if (path == "chat.prefix") settings.chat.prefix = value;
	if (path == "round.time") settings.round.time = parseFloat(value);
	if (path == "round.mode") settings.round.mode = value == "dm" ? "dm" : "knife";
	if (path == "maps") settings.maps = value.split(",");
	if (path == "motd") settings.motd = value == "-" ? undefined : value;
	if (path == "items") settings.shop.items = value.split(",").map(item);
	if (path == "prices") settings.prices = prices(value);

	if (path == "extra.note") {
		if (value == "-") settings.extra = undefined;
		else settings.extra = { note: value };
	}
}

function item(text: string) {
	const parts = text.split(":");
	const made: Item = { name: parts[0], price: parseFloat(parts[1]), tags: [] };
	return made;
}

function prices(text: string) {
	const map = new Map<string, number>();
	for (const pair of text.split(",")) map.set(pair.split(":")[0], parseFloat(pair.split(":")[1]));
	return map;
}

function dumpSettings(settings: Settings) {
	const items = settings.shop.items.map(one => `${one.name}:${one.price}:${one.tags.join("+")}:${shown(one.sale)}`);
	const prices = settings.prices.keys().map(key => `${key}:${settings.prices.get(key)}`);
	const extra = settings.extra;
	return [
		`chat.prefix=${settings.chat.prefix}`,
		`chat.colors=${settings.chat.colors}`,
		`round.time=${settings.round.time}`,
		`round.mode=${settings.round.mode}`,
		`round.modes=${settings.round.modes.join(",")}`,
		`maps=${settings.maps.join(",")}`,
		`weights=${settings.weights.join(",")}`,
		`flags=${settings.flags.join(",")}`,
		`items=${items.join(",")}`,
		`prices=${prices.join(",")}`,
		`motd=${settings.motd ?? "?"}`,
		`limit=${shown(settings.limit)}`,
		`hidden=${settings.hidden === undefined ? "?" : `${settings.hidden}`}`,
		`extra=${extra === undefined ? "?" : `${extra.note}:${shown(extra.level)}`}`,
	].join("\n");
}

/** A number that may be left out: "?" when it is. */
function shown(value?: number) {
	return value === undefined ? "?" : `${value}`;
}
