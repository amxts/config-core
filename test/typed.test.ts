// Configs read into typed objects: configs.load(name, defaults) and
// configs.save(settings). The playground's Typed plugin loads them as any
// plugin does - through Config Core's plugin - and shows the object as lines
// of `path=value`, "?" for a field left out.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { setup } from "@amxts/core/test-utils";

setDefaultTimeout(120_000);

const CONFIGS = "addons/amxmodx/configs";

async function boot(files: Record<string, string> = {}) {
	const inConfigs = Object.fromEntries(Object.entries(files).map(([path, text]) => [`${CONFIGS}/${path}`, text]));
	const server = await setup({ rootDir: "playground", plugins: ["typed"], files: inConfigs });
	const read = (name: string) => server.native("typed_read", name) as string;
	const edit = (name: string, ...edits: string[]) => server.native("typed_edit", name, edits.join("\n")) as string;
	const file = (name: string) => server.file(`${CONFIGS}/${name}`);
	const warnings = () => server.log.split("\n").filter(line => line.startsWith("warning:")).map(line => line.replace(`warning: [ConfigCore] ${CONFIGS}/`, ""));
	return { server, read, edit, file, warnings };
}

const lines = (...all: string[]) => all.join("\n");

/** What typed_read() shows for the defaults, a line a field. */
const DEFAULTS = [
	"chat.prefix=[HNS]",
	"chat.colors=true",
	"round.time=2.5",
	"round.mode=normal",
	"round.modes=normal",
	"maps=de_dust2",
	"weights=1,2",
	"flags=true",
	"items=knife:0::?",
	"prices=",
	"motd=Welcome",
	"limit=?",
	"hidden=?",
	"extra=?",
];

/** The defaults with some lines changed: "path=value" replaces the line of that path. */
function defaultsWith(...changed: string[]) {
	return lines(...DEFAULTS.map((line) => {
		const path = line.slice(0, line.indexOf("="));
		return changed.find(each => each.startsWith(`${path}=`)) ?? line;
	}));
}

describe("reading", () => {
	test("no file: the defaults, and nothing said", async () => {
		const { read, warnings } = await boot();
		expect(read("settings")).toBe(lines(...DEFAULTS));
		expect(warnings()).toEqual([]);
	});

	test("what the file has replaces the default, field by field; the rest stays", async () => {
		const { read, warnings } = await boot({ "settings.yaml": "chat:\n  prefix: \"[X]\"\nround:\n  mode: dm\nmaps: [de_inferno, de_nuke]\nlimit: 10\n" });
		expect(read("settings")).toBe(defaultsWith("chat.prefix=[X]", "round.mode=dm", "maps=de_inferno,de_nuke", "limit=10"));
		expect(warnings()).toEqual([]);
	});

	test("every kind: numbers, booleans, names, lists, lists of objects, a Map, optional fields and objects", async () => {
		const { read, warnings } = await boot({
			"settings.yaml": lines(
				"chat: { prefix: '>', colors: false }",
				"round: { time: 3, mode: knife, modes: [dm, knife] }",
				"weights: [0.5, 2]",
				"flags: [true, false]",
				"shop:",
				"  items:",
				"    - { name: awp, price: 4750, tags: [sniper, rifle], sale: 10 }",
				"    - { name: ak, price: 2700, tags: [] }",
				"prices: { de_dust2: 3, de_nuke: 1.5 }",
				"motd: Hi",
				"hidden: true",
				"extra: { note: n, level: 2 }",
			),
		});
		expect(read("settings")).toBe(lines(
			"chat.prefix=>",
			"chat.colors=false",
			"round.time=3",
			"round.mode=knife",
			"round.modes=dm,knife",
			"maps=de_dust2",
			"weights=0.5,2",
			"flags=true,false",
			"items=awp:4750:sniper+rifle:10,ak:2700::?",
			"prices=de_dust2:3,de_nuke:1.5",
			"motd=Hi",
			"limit=?",
			"hidden=true",
			"extra=n:2",
		));
		expect(warnings()).toEqual([]);
	});

	test("a value of the wrong kind keeps the default, and the console says where", async () => {
		const { read, warnings } = await boot({
			"settings.yaml": lines(
				"chat:",
				"  prefix: [a]",
				"  colors: maybe",
				"round:",
				"  time: soon",
				"maps: 5",
				"shop: []",
				"prices: 1",
			),
		});
		expect(read("settings")).toBe(defaultsWith("maps=5"));
		expect(warnings()).toEqual([
			"settings.yaml:2:3: \"prefix\" is a list, not text - the default stays",
			"settings.yaml:3:3: \"colors\" is text (\"maybe\"), not true or false - the default stays",
			"settings.yaml:5:3: \"time\" is text (\"soon\"), not a number - the default stays",
			"settings.yaml:7:1: \"shop\" is a list, not an object - the defaults stay",
			"settings.yaml:8:1: \"prices\" is a number, not an object - the default stays",
		]);
	});

	test("a name not in its union keeps the default, with the nearest one; in a list it is left out", async () => {
		const { read, warnings } = await boot({ "settings.yaml": "round:\n  mode: DM\n  modes: [dm, knif, normal]\n" });
		expect(read("settings")).toBe(defaultsWith("round.modes=dm,normal"));
		expect(warnings()).toEqual([
			"settings.yaml:2:3: \"mode\" is \"DM\", not one of \"normal\", \"dm\", \"knife\" - did you mean \"dm\"? - the default stays",
			"settings.yaml:3:15: the item is \"knif\", not one of \"normal\", \"dm\", \"knife\" - did you mean \"knife\"? - it is left out",
		]);
	});

	test("a key the object does not have is said, with the nearest one it has", async () => {
		const { read, warnings } = await boot({ "settings.yaml": "chat:\n  prefx: \"[X]\"\nmap: [a]\nshop:\n  items:\n    - { name: a, price: 1, tags: [], sael: 5 }\n" });
		expect(read("settings")).toBe(defaultsWith("items=a:1::?"));
		expect(warnings()).toEqual([
			"settings.yaml:3:1: unknown key \"map\" - did you mean \"maps\"?",
			"settings.yaml:2:3: unknown key \"prefx\" in \"chat\" - did you mean \"prefix\"?",
			"settings.yaml:6:38: unknown key \"sael\" - did you mean \"sale\"?",
		]);
	});

	test("an item of a list that is not of its kind is left out; an object's missing fields are empty", async () => {
		const { read, warnings } = await boot({ "settings.yaml": "weights: [1, x, 3]\nshop:\n  items:\n    - name: awp\n      price: 1\n      tags: [a]\n    - 5\n    - name: ak\nextra:\n  level: 2\n" });
		expect(read("settings")).toBe(defaultsWith("weights=1,3", "items=awp:1:a:?,ak:0::?", "extra=:2"));
		expect(warnings()).toEqual([
			"settings.yaml:1:14: the item is text (\"x\"), not a number - it is left out",
			"settings.yaml:7:7: the item is a number, not an object - it is left out",
			"settings.yaml:8:7: \"price\" is missing - it is left empty",
			"settings.yaml:8:7: \"tags\" is missing - it is left empty",
			"settings.yaml:9:1: \"note\" is missing - it is left empty",
		]);
	});

	test("empty (null) is the default; one value where a list goes is a list of one", async () => {
		const { read, warnings } = await boot({ "settings.yaml": "chat:\n  prefix:\nmaps: de_train\nround: ~\n" });
		expect(read("settings")).toBe(defaultsWith("maps=de_train"));
		expect(warnings()).toEqual([]);
	});

	test("JSON reads the same", async () => {
		const { read, warnings } = await boot({ "settings.json": "{\n  // the chat\n  \"chat\": { \"prefix\": \"[J]\", \"colors\": 0 },\n  \"round\": { \"time\": \"4\" },\n  \"motd\": null,\n}\n" });
		expect(read("settings")).toBe(defaultsWith("chat.prefix=[J]", "chat.colors=false", "round.time=4"));
		expect(warnings()).toEqual([]);
	});

	test("the shape from the defaults' literal, when no type is given", async () => {
		const { server, warnings } = await boot({ "simple.yaml": "round: { mode: knife }\nteam:\n  size: 3\n  list: [{ nick: b, skill: 2 }, { nick: c, skill: 3 }]\n" });
		expect(server.native("typed_simple", "simple")).toBe("[HNS]|2.5|knife|de_dust2|3|false|b:2,c:3");
		expect(warnings()).toEqual([]);
	});

	test("the defaults are copied: changing what load() gave does not change them", async () => {
		const { server } = await boot();
		expect(server.native("typed_defaults_kept", "kept")).toBe("[D]|a");
	});
});

describe("INI", () => {
	test("[section] key = value is section.key: keys in any case, lists of words, 1 and 0", async () => {
		const { read, warnings } = await boot({ "settings.ini": "; the chat\n[chat]\nPREFIX = [I]\ncolors = 0\n\n[round]\ntime = 3.5\nmode = dm\nmodes = dm knife\n\n[prices]\nde_dust2 = 5\n" });
		expect(read("settings")).toBe(defaultsWith("chat.prefix=[I]", "chat.colors=false", "round.time=3.5", "round.mode=dm", "round.modes=dm,knife", "prices=de_dust2:5"));
		expect(warnings()).toEqual([
			"settings.ini: \"maps\" cannot be in an INI file, whose values are in [sections] - it stays the default; write the config in YAML or JSON",
			"settings.ini: \"weights\" cannot be in an INI file, whose values are in [sections] - it stays the default; write the config in YAML or JSON",
			"settings.ini: \"flags\" cannot be in an INI file, whose values are in [sections] - it stays the default; write the config in YAML or JSON",
			"settings.ini: \"motd\" cannot be in an INI file, whose values are in [sections] - it stays the default; write the config in YAML or JSON",
			"settings.ini: \"limit\" cannot be in an INI file, whose values are in [sections] - it stays the default; write the config in YAML or JSON",
			"settings.ini: \"hidden\" cannot be in an INI file, whose values are in [sections] - it stays the default; write the config in YAML or JSON",
			"settings.ini: \"shop.items\" cannot be in an INI file, which has no lists of objects - it stays the default; write the config in YAML or JSON",
		]);
	});

	test("a section's name is as written: [ROUND] is not round, and is said", async () => {
		const { read, warnings } = await boot({ "settings.ini": "[ROUND]\ntime = 9\n[chat]\nprefix =\n" });
		expect(read("settings")).toBe(defaultsWith("chat.prefix="));
		expect(warnings().filter(line => !line.includes("cannot be in an INI file"))).toEqual([
			"settings.ini:1: unknown key \"ROUND\" - did you mean \"round\"?",
		]);
	});

	test("save() writes the sections back, the file's comments and key case kept", async () => {
		const { edit, file } = await boot({ "settings.ini": "; the chat\n[chat]\nPREFIX = [I]\ncolors = 0\n\n; rounds\n[round]\ntime = 3\n" });
		expect(edit("settings", "chat.prefix=[Y]", "round.time=4.5", "prices=a:1,b:2")).toStartWith("true\n");
		expect(file("settings.ini")).toBe(lines(
			"; the chat",
			"[chat]",
			"PREFIX = [Y]",
			"colors = 0",
			"",
			"; rounds",
			"[round]",
			"time = 4.5",
			"mode = normal",
			"modes = normal",
			"",
			"[prices]",
			"a = 1",
			"b = 2",
			"",
		));
	});

	test("a block of rows is a list of lists, and stays a block - rows of one value too - when saved", async () => {
		const { server, file, warnings } = await boot({
			"rows.ini": "[main]\n; id and value\ncvars = {\n\t; the first\n\t\"A\" \"1\"\n\t\"B\" \"\" \"2\"\n}\nmaps = {\n\t\"de_nuke\"\n\t\"de_inferno\"\n}\n",
			"empty.ini": "[main]\ncvars = {\n}\nmaps =\n",
		});
		const rows = (name: string, row = "") => server.native("typed_rows", name, row) as string;
		expect(rows("rows")).toBe("false|A,1;B,,2|de_nuke,de_inferno");
		expect(rows("empty")).toBe("false||");
		expect(warnings()).toEqual([]);
		expect(rows("rows", "C,3")).toBe("true|A,1;B,,2;C,3|de_nuke,de_inferno");
		expect(file("rows.ini")).toBe(lines(
			"[main]",
			"; id and value",
			"cvars = {",
			"\t; the first",
			"\t\"A\" \"1\"",
			"\t\"B\" \"\" \"2\"",
			"\t\"C\" \"3\"",
			"}",
			"maps = {",
			"\t\"de_nuke\"",
			"\t\"de_inferno\"",
			"}",
			"",
		));
	});
});

describe("saving", () => {
	test("a file that is not there is written as YAML, every field in it", async () => {
		const { edit, file } = await boot();
		expect(edit("settings")).toBe(`true\n${lines(...DEFAULTS)}`);
		expect(file("settings.yaml")).toBe(lines(
			"chat:",
			"  prefix: \"[HNS]\"",
			"  colors: true",
			"round:",
			"  time: 2.5",
			"  mode: normal",
			"  modes:",
			"    - normal",
			"maps:",
			"  - de_dust2",
			"weights:",
			"  - 1",
			"  - 2",
			"flags:",
			"  - true",
			"shop:",
			"  items:",
			"    - name: knife",
			"      price: 0",
			"      tags: []",
			"motd: Welcome",
			"",
		));
	});

	test("YAML: changed values in place, comments kept, a list of objects resized, a left-out field removed", async () => {
		const { edit, file } = await boot({
			"settings.yaml": lines(
				"# the chat",
				"chat:",
				"  prefix: \"[X]\"",
				"  colors: false",
				"",
				"# what the shop sells",
				"shop:",
				"  items:",
				"    # the first",
				"    - name: awp",
				"      price: 4750",
				"      tags: [sniper]",
				"    - name: ak",
				"      price: 2700",
				"      tags: []",
				"motd: Hello",
				"",
			),
		});
		expect(edit("settings", "chat.prefix=[Y]", "items=m4:3100", "motd=-", "prices=de_dust2:2")).toBe(`true\n${defaultsWith("chat.prefix=[Y]", "chat.colors=false", "items=m4:3100::?", "prices=de_dust2:2", "motd=?")}`);
		expect(file("settings.yaml")).toBe(lines(
			"# the chat",
			"chat:",
			"  prefix: \"[Y]\"",
			"  colors: false",
			"",
			"# what the shop sells",
			"shop:",
			"  items:",
			"    # the first",
			"    - name: m4",
			"      price: 3100",
			"      tags: []",
			"round:",
			"  time: 2.5",
			"  mode: normal",
			"  modes:",
			"    - normal",
			"maps:",
			"  - de_dust2",
			"weights:",
			"  - 1",
			"  - 2",
			"flags:",
			"  - true",
			"prices:",
			"  de_dust2: 2",
			"",
		));
	});

	test("JSON: written in its indentation, comments kept; an optional object added", async () => {
		const { edit, file } = await boot({ "settings.json": "{\n    // the chat\n    \"chat\": { \"prefix\": \"[J]\" },\n    \"maps\": [\"x\"]\n}\n" });
		expect(edit("settings", "chat.prefix=[Y]", "extra.note=hi")).toStartWith("true\n");
		expect(file("settings.json")).toBe(lines(
			"{",
			"    // the chat",
			"    \"chat\": {",
			"        \"prefix\": \"[Y]\",",
			"        \"colors\": true",
			"    },",
			"    \"maps\": [\"x\"],",
			"    \"round\": {",
			"        \"time\": 2.5,",
			"        \"mode\": \"normal\",",
			"        \"modes\": [\"normal\"]",
			"    },",
			"    \"weights\": [1, 2],",
			"    \"flags\": [true],",
			"    \"shop\": {",
			"        \"items\": [",
			"            {",
			"                \"name\": \"knife\",",
			"                \"price\": 0,",
			"                \"tags\": []",
			"            }",
			"        ]",
			"    },",
			"    \"motd\": \"Welcome\",",
			"    \"extra\": {",
			"        \"note\": \"hi\"",
			"    }",
			"}",
			"",
		));
	});

	test("what save() wrote reads back the same, in each format", async () => {
		for (const [name, empty] of [["settings.yaml", ""], ["settings.json", "{}\n"], ["settings.ini", ""]]) {
			const { edit, file } = await boot({ [name]: empty });
			const saved = edit("settings", "chat.prefix=[Z]", "round.time=7", "round.mode=dm", "prices=k:3,m:0.5");
			expect(saved).toBe(`true\n${defaultsWith("chat.prefix=[Z]", "round.time=7", "round.mode=dm", "prices=k:3,m:0.5")}`);
			const again = await boot({ [name]: file(name) });
			expect(again.read("settings")).toBe(saved.slice("true\n".length));
		}
	});

	test("a value that did not change stays as the file writes it: 2.50 is not made 2.5", async () => {
		const { edit, file } = await boot({ "settings.yaml": "round:\n  time: 2.50\n", "other.ini": "[round]\ntime = 2.50\n" });
		edit("settings.yaml", "chat.prefix=[X]");
		edit("other.ini", "chat.prefix=[X]");
		expect(file("settings.yaml")).toStartWith("round:\n  time: 2.50\n");
		expect(file("other.ini")).toStartWith("[round]\ntime = 2.50\n");
	});

	test("save() of an object load() did not read writes nothing, and says so", async () => {
		const { server } = await boot();
		expect(server.native("typed_save_foreign")).toBe(false);
		expect(server.log).toContain("error: [ConfigCore] configs.save(): this object was not read by configs.load() - nothing is written");
	});
});

describe("the playground's Rules plugin", () => {
	test("/rules prints the file's rules with its prefix, and counts itself in the file", async () => {
		const server = await setup({ rootDir: "playground", plugins: ["rules"], files: { [`${CONFIGS}/rules.yaml`]: "# the rules\nchat:\n  prefix: \"[HNS]\"\n  rules: [Be nice, No cheats]\n" } });
		const player = server.join("Alice");
		player.say("/rules");
		player.say("/rules");
		expect(player.chat).toContain("[HNS] Be nice");
		expect(player.chat).toContain("[HNS] No cheats");
		expect(server.file(`${CONFIGS}/rules.yaml`)).toBe(lines(
			"# the rules",
			"chat:",
			"  prefix: \"[HNS]\"",
			"  rules:",
			"    - Be nice",
			"    - No cheats",
			"stats:",
			"  shown: 2",
			"",
		));
	});
});
