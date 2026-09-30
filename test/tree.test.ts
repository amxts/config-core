// Config Core's tree: YAML, JSON and INI files read into one shape, read by
// path and written back. The playground's Dump plugin reads them through the
// module, as any plugin does - each value it shows crossed from Config Core's
// plugin - and prints a line a value: its path, kind, text and place.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { setup } from "@amxts/core/test-utils";

setDefaultTimeout(120_000);

const CONFIGS = "addons/amxmodx/configs";

async function boot(files: Record<string, string> = {}) {
	const inConfigs = Object.fromEntries(Object.entries(files).map(([path, text]) => [`${CONFIGS}/${path}`, text]));
	const server = await setup({ rootDir: "playground", files: inConfigs });
	const dump = (name: string) => server.native("config_dump", name) as string;
	const parse = (text: string, format: "yaml" | "json" | "ini") => server.native("config_parse", text, format) as string;
	const edit = (name: string, ...edits: string[]) => server.native("config_edit", name, edits.join("\n")) as string;
	const get = (name: string, path: string) => server.native("config_get", name, path) as string;
	const file = (name: string) => server.file(`${CONFIGS}/${name}`);
	const errors = () => server.log.split("\n").filter(line => line.startsWith("error:"));
	return { server, dump, parse, edit, get, file, errors };
}

const lines = (...all: string[]) => all.join("\n");

describe("YAML", () => {
	test("scalars take their type as YAML's core schema gives it; quoted text stays text", async () => {
		const { parse } = await boot();
		const text = "a: 1\nb: -2.5\nc: 0x1F\nd: 0o17\ne: 1e3\nf: .inf\ng: -.Inf\nh: .nan\ni: true\nj: False\nk: ~\nl:\nm: null\nn: \"12\"\no: 1.2.3\np: yes\nq: '0x1F'\n";
		expect(parse(text, "yaml")).toBe(lines(
			" object @1:1",
			".a number 1 @1:1",
			".b number -2.5 @2:1",
			".c number 0x1F @3:1",
			".d number 0o17 @4:1",
			".e number 1e3 @5:1",
			".f number .inf @6:1",
			".g number -.Inf @7:1",
			".h number .nan @8:1",
			".i boolean true @9:1",
			".j boolean false @10:1",
			".k null  @11:1",
			".l null  @12:1",
			".m null  @13:1",
			".n string 12 @14:1",
			".o string 1.2.3 @15:1",
			".p string yes @16:1",
			".q string 0x1F @17:1",
		));
	});

	test("quoted text: escapes in \"...\", '' in '...', a line break folded to a space", async () => {
		const { parse } = await boot();
		const text = "s: \"a\\tb\\n\\\"q\\\" \\\\ \\u00e9 \\x41\"\nt: 'it''s'\nu: \"one\n  two\n\n  three\"\n";
		expect(parse(text, "yaml")).toBe(lines(
			" object @1:1",
			".s string a\tb\\n\"q\" \\ é A @1:1",
			".t string it's @2:1",
			".u string one two\\nthree @3:1",
		));
	});

	test("| and > blocks: kept and folded lines, the last line end clipped, stripped or kept", async () => {
		const { parse } = await boot();
		const text = "lit: |\n  line 1\n    indented\n\n  line 3\nkeep: |+\n  a\n\nstrip: |-\n  a\n  b\nfold: >\n  a\n  b\n\n  c\n    d\n  e\nafter: x\n";
		expect(parse(text, "yaml")).toBe(lines(
			" object @1:1",
			".lit string line 1\\n  indented\\n\\nline 3\\n @1:1",
			".keep string a\\n\\n @6:1",
			".strip string a\\nb @9:1",
			".fold string a b\\nc\\n  d\\ne\\n @12:1",
			".after string x @19:1",
		));
	});

	test("[ ] and { } on one line or several, a comma after the last item, empty ones", async () => {
		const { parse } = await boot();
		expect(parse("f: [a, 'b c', 3, {x: 1, y: [2]}, ]\ng: {a: 1,\n  b: two, c: }\nh: []\ni: {}\n", "yaml")).toBe(lines(
			" object @1:1",
			".f array @1:1",
			".f[0] string a @1:5",
			".f[1] string b c @1:8",
			".f[2] number 3 @1:15",
			".f[3] object @1:18",
			".f[3].x number 1 @1:19",
			".f[3].y array @1:25",
			".f[3].y[0] number 2 @1:29",
			".g object @2:1",
			".g.a number 1 @2:5",
			".g.b string two @3:3",
			".g.c null  @3:11",
			".h array @4:1",
			".i object @5:1",
		));
	});

	test("lists: at the key's indentation or under it, of mappings, of lists, an item on the next line", async () => {
		const { parse } = await boot();
		expect(parse("list:\n- a\n- b\nnext: 1\nitems:\n  - name: x\n    cond: y\n  - - p\n    - q\n  -\n    deep: 1\n  - \n", "yaml")).toBe(lines(
			" object @1:1",
			".list array @1:1",
			".list[0] string a @2:3",
			".list[1] string b @3:3",
			".next number 1 @4:1",
			".items array @5:1",
			".items[0] object @6:5",
			".items[0].name string x @6:5",
			".items[0].cond string y @7:5",
			".items[1] array @8:5",
			".items[1][0] string p @8:7",
			".items[1][1] string q @9:7",
			".items[2] object @11:5",
			".items[2].deep number 1 @11:5",
			".items[3] null  @12:3",
		));
	});

	test("comments: # after a space; one # inside a value is the value's; --- and ... around the document", async () => {
		const { parse } = await boot();
		expect(parse("---\n# lead\nk: v # inline\nurl: http://x.y/z#frag\n\n# before\nz: 1\n...\n# end\n", "yaml")).toBe(lines(
			" object @3:1",
			".k string v @3:1",
			".url string http://x.y/z#frag @4:1",
			".z number 1 @7:1",
		));
	});

	test("an empty file, a list at the top, text at the top, Cyrillic, a BOM and CRLF", async () => {
		const { parse } = await boot();
		expect(parse("", "yaml")).toBe(" object @1:1");
		expect(parse("# only a comment\n", "yaml")).toBe(" object @1:1");
		expect(parse("- 1\n- two\n", "yaml")).toBe(" array @1:1\n[0] number 1 @1:3\n[1] string two @2:3");
		expect(parse("just text\n", "yaml")).toBe(" string just text @1:1");
		expect(parse("имя: значение\nключ: \"Привет\"\n", "yaml")).toBe(" object @1:1\n.имя string значение @1:1\n.ключ string Привет @2:1");
		expect(parse("\uFEFFa: 1\r\nb: 2\r\n", "yaml")).toBe(" object @1:1\n.a number 1 @1:1\n.b number 2 @2:1");
	});

	test("what is not supported stops the reading, said with the line and the column; the file reads empty", async () => {
		const { parse, errors } = await boot();
		const cases: [string, string][] = [
			["a:\n\tb: 1\n", "2:1: a tab indents this line - YAML indents with spaces"],
			["a: &x 1\n", "1:4: anchors and aliases (& and *) are not supported - write the value out"],
			["a: *x\n", "1:4: anchors and aliases (& and *) are not supported - write the value out"],
			["a: !!str 1\n", "1:4: tags (!) are not supported - write the value as it is"],
			["? a\n: b\n", "1:1: complex keys (?) are not supported"],
			["%YAML 1.2\n---\na: 1\n", "1:1: directives (%YAML, %TAG) are not supported - remove the line"],
			["a: 1\n---\nb: 2\n", "2:1: a second document (---) - a config file holds one"],
			["a: 1\na: 2\n", "2:1: \"a\" is here twice - first on line 1"],
			["{a: 1, a: 2}\n", "1:8: \"a\" is here twice - first on line 1"],
			["a: \"open\n", "1:4: a quoted value that is never closed"],
			["a: [1, 2\n", "2:1: expected , or ] after an item"],
			["a: b: c\n", "1:5: \": \" in a value - quote the value"],
			["a: 1\n  b: 2\n", "2:3: indented deeper than the key above - a value that goes on for several lines is quoted, or written after | or >"],
			["a: %name%\n", "1:4: a value cannot start with % - quote it: \"%...\""],
			["a: - b\n", "1:4: a list cannot start on the line of its key - put it on the next line"],
			["a: 1\n- b\n", "2:1: a list item among keys - indent the list under its key"],
			["a:\n  - x\n  y: 1\n", "3:3: a key among the items of a list - an item starts with \"- \""],
			["a: \"x\" y\n", "1:8: unexpected text after the value"],
			["a: \"\\q\"\n", "1:5: an unknown escape \\q"],
		];
		for (const [text, error] of cases) {
			expect(parse(text, "yaml")).toBe(" object @1:1");
			expect(errors().at(-1)).toBe(`error: [ConfigCore] text:${error}`);
		}
	});
});

describe("JSON", () => {
	test("values, their kinds and places; escapes, a surrogate pair", async () => {
		const { parse } = await boot();
		expect(parse("{\"a\": 1, \"b\": -2.5e3, \"c\": true, \"d\": null, \"e\": \"x\\u00e9\\n\\\"\", \"f\": [1, [2], {\"g\": {}}], \"h\": []}", "json")).toBe(lines(
			" object @1:1",
			".a number 1 @1:2",
			".b number -2.5e3 @1:10",
			".c boolean true @1:23",
			".d null  @1:34",
			".e string xé\\n\" @1:45",
			".f array @1:65",
			".f[0] number 1 @1:71",
			".f[1] array @1:74",
			".f[1][0] number 2 @1:75",
			".f[2] object @1:79",
			".f[2].g object @1:80",
			".h array @1:91",
		));
		expect(parse("\"\\ud83d\\ude00\"", "json")).toBe(" string 😀 @1:1");
		expect(parse("", "json")).toBe(" object @1:1");
	});

	test("JSONC: // and /* */ comments, a comma after the last member and item", async () => {
		const { parse } = await boot();
		expect(parse("// lead\n{\n  /* block\n     two */\n  \"a\": 1, // trailing\n\n  \"b\": [1, 2,],\n}\n// end\n", "json")).toBe(lines(
			" object @2:1",
			".a number 1 @5:3",
			".b array @7:3",
			".b[0] number 1 @7:9",
			".b[1] number 2 @7:12",
		));
	});

	test("mistakes stop the reading, said with the line and the column", async () => {
		const { parse, errors } = await boot();
		const cases: [string, string][] = [
			["{'a': 1}", "1:2: a key is written in double quotes"],
			["{\"a\": 1 \"b\": 2}", "1:9: expected , or }"],
			["{\"a\": 1, \"a\": 2}", "1:10: \"a\" is here twice - first on line 1"],
			["{\"a\": [1, 2}", "1:12: expected , or ]"],
			["{\"a\": 1} x", "1:10: unexpected text after the end of the value"],
			["{\"a\": 01}", "1:7: \"01\" is not a value - text is written in double quotes"],
			["{\"a\": NaN}", "1:7: \"NaN\" is not a value - text is written in double quotes"],
			["{\"a\": \"x\n\"}", "1:7: text that is never closed with \""],
			["/* open", "1:1: a /* comment that is never closed with */"],
			["[1,\n 2", "2:3: expected , or ]"],
		];
		for (const [text, error] of cases) {
			expect(parse(text, "json")).toBe(" object @1:1");
			expect(errors().at(-1)).toBe(`error: [ConfigCore] text:${error}`);
		}
	});
});

describe("INI as a tree", () => {
	const INI = "; top\n[MAIN]\nCHAT_PREFIX = [HNS]\nMAPS = de_dust2 de_nuke\nEMPTY =\n\n; hud\nHUD = {\n\tHIDE_TIME = 255 50 50\n}\nCVARS = {\n\t\"mp_timelimit\" \"30\"\n\t\"mp_freezetime\"\n}\nCHAT_PREFIX = second\n[OTHER]\nK = v\n[OTHER]\nK = last\n";

	test("sections are objects; a line of several values a list; a block of rows a list of rows; lines kept", async () => {
		const { dump } = await boot({ "i.ini": INI });
		expect(dump("i.ini")).toBe(lines(
			" object @1:0",
			".MAIN object @2:0",
			".MAIN.CHAT_PREFIX string [HNS] @3:0",
			".MAIN.MAPS array @4:0",
			".MAIN.MAPS[0] string de_dust2 @4:0",
			".MAIN.MAPS[1] string de_nuke @4:0",
			".MAIN.EMPTY null  @5:0",
			".MAIN.HUD object @8:0",
			".MAIN.HUD.HIDE_TIME array @9:0",
			".MAIN.HUD.HIDE_TIME[0] string 255 @9:0",
			".MAIN.HUD.HIDE_TIME[1] string 50 @9:0",
			".MAIN.HUD.HIDE_TIME[2] string 50 @9:0",
			".MAIN.CVARS array @11:0",
			".MAIN.CVARS[0] array @12:0",
			".MAIN.CVARS[0][0] string mp_timelimit @12:0",
			".MAIN.CVARS[0][1] string 30 @12:0",
			".MAIN.CVARS[1] string mp_freezetime @13:0",
			".OTHER object @18:0",
			".OTHER.K string last @19:0",
		));
	});

	test("keys found as the INI functions find them: in any case, the first of a key, the last of a section; values read as any type", async () => {
		const { get } = await boot({ "i.ini": INI });
		expect(get("i", "MAIN.chat_prefix")).toBe("[HNS]|-1|false/true|[HNS]|true||0");
		expect(get("i", "main.CHAT_PREFIX")).toBe("-|-1|false/true||false||0");
		expect(get("i", "MAIN.MAPS")).toBe("-|-1|false/true|de_dust2,de_nuke|true||2");
		expect(get("i", "MAIN.hud.hide_time[0]")).toBe("255|255|true/true|255|true||0");
		expect(get("i", "MAIN.CVARS[0][1]")).toBe("30|30|true/true|30|true||0");
		expect(get("i", "MAIN.CVARS.0.1")).toBe("-|-1|false/true||false||0"); // an item is [0]
		expect(get("i", "MAIN")).toBe("-|-1|false/true||true|CHAT_PREFIX,MAPS,EMPTY,HUD,CVARS|5");
	});
});

describe("finding the file", () => {
	test("a name without an extension: .ini, .yaml, .yml, .json, .jsonc in this order; two of them are an error", async () => {
		const { dump, errors } = await boot({
			"a.yml": "k: yml\n",
			"b.jsonc": "{ \"k\": \"jsonc\" }",
			"c.json": "{ \"k\": \"json\" }",
			"c.yaml": "k: yaml\n",
			"c.ini": "[S]\nK = ini\n",
		});
		expect(dump("a")).toBe(" object @1:1\n.k string yml @1:1");
		expect(dump("b")).toBe(" object @1:1\n.k string jsonc @1:3");
		expect(dump("c")).toBe(" object @1:0\n.S object @1:0\n.S.K string ini @2:0");
		expect(errors()).toEqual([`error: [ConfigCore] ${CONFIGS}/c: c.ini, c.yaml, c.json are all there - c.ini is read; keep one of them`]);
		expect(dump("c.json")).toBe(" object @1:1\n.k string json @1:3");
	});

	test("a file that is not there reads empty and is saved as YAML; the error of a file names it", async () => {
		const { dump, edit, file, errors } = await boot({ "bad.json": "{\n  \"a\": 1,,\n}" });
		expect(dump("nothing")).toBe(" object @1:1");
		expect(edit("nothing", "a.b=1", "c=#2")).toBe("111");
		expect(file("nothing.yaml")).toBe("a:\n  b: \"1\"\nc: 2\n");
		expect(dump("bad")).toBe(" object @1:1");
		expect(errors()).toEqual([`error: [ConfigCore] ${CONFIGS}/bad.json:2:10: a key is written in double quotes`]);
	});
});

describe("writing back", () => {
	test("YAML: values changed in place, comments on their own lines kept, new keys made on their path", async () => {
		const yaml = "# Settings\nchat:\n  prefix: \"[HNS]\"   # inline\n  rules:\n    - be nice\n    - no cheats\n\n# timing\nround:\n  time: 2.5\nlist:\n  - name: a\n    x: 1\n  - [1, 2]\n  - - p\n    - q\n";
		const { edit, file, dump } = await boot({ "s.yaml": yaml });
		expect(edit("s", "chat.prefix=: NEW", "round.time=#3", "round.freeze=#5", "hud.enabled=?true", "chat.rules=[a,b c]", "list[0].x=#2", "list[3]=d", "list[9]=z", "chat.prefix.deep=x", "-list[1]", "-nope", "list.0.x=#7", "-list.0")).toBe("11111110010001"); // an item is [0]: list.0 is not one
		expect(file("s.yaml")).toBe(lines(
			"# Settings",
			"chat:",
			"  prefix: \": NEW\"",
			"  rules:",
			"    - a",
			"    - b c",
			"",
			"# timing",
			"round:",
			"  time: 3",
			"  freeze: 5",
			"list:",
			"  - name: a",
			"    x: 2",
			"  - - p",
			"    - q",
			"  - d",
			"hud:",
			"  enabled: true",
			"",
		));
		expect(dump("s")).toContain(".chat.prefix string : NEW @3:3");
	});

	test("JSON: its indentation and comments kept, a short list on one line", async () => {
		const json = "// Settings\n{\n\t\"chat\": {\n\t\t// the prefix\n\t\t\"prefix\": \"[HNS]\",\n\t\t\"rules\": [\"be nice\", \"no cheats\"],\n\t},\n\n\t\"round\": { \"time\": 2.5 }\n}\n";
		const { edit, file } = await boot({ "j.jsonc": json });
		expect(edit("j", "chat.prefix=\"new\"", "round.time=#3", "hud.enabled=?false", "chat.names=[a,b]", "-chat.rules")).toBe("111111");
		expect(file("j.jsonc")).toBe(lines(
			"// Settings",
			"{",
			"\t\"chat\": {",
			"\t\t// the prefix",
			"\t\t\"prefix\": \"\\\"new\\\"\",",
			"\t\t\"names\": [\"a\", \"b\"]",
			"\t},",
			"",
			"\t\"round\": {",
			"\t\t\"time\": 3",
			"\t},",
			"\t\"hud\": {",
			"\t\t\"enabled\": false",
			"\t}",
			"}",
			"",
		));
	});

	test("INI: through the tree as well, a section made at run time after a blank line", async () => {
		const { edit, file } = await boot({ "i.ini": "; top\n[MAIN]\nCHAT_PREFIX = [HNS]\nHUD = {\n\tHIDE_TIME = 255 50 50\n}\n[OTHER]\nK = v\n" });
		expect(edit("i", "MAIN.chat_prefix=X Y", "MAIN.NEW=#1.5", "MAIN.FLAG=?true", "NEW.K=v", "MAIN.HUD.HIDE_TIME=1")).toBe("111111");
		expect(file("i.ini")).toBe(lines(
			"; top",
			"[MAIN]",
			"CHAT_PREFIX = \"X Y\"",
			"HUD = {",
			"\tHIDE_TIME = 1",
			"}",
			"NEW = 1.5",
			"FLAG = 1",
			"[OTHER]",
			"K = v",
			"",
			"[NEW]",
			"K = v",
			"",
		));
	});

	test("what YAML writes reads back the same", async () => {
		const yaml = "a: \"12\"\nb: \"yes\"\nc: \"- x\"\nd: \"a: b\"\ne: \"%name%\"\nf: \"line\\nnext\"\ng: \"\"\nh: ~\ni: [1, 'two']\nj: {}\nk: \"!y[%d]!w\"\n";
		const { dump, edit, file } = await boot({ "r.yaml": yaml });
		const before = dump("r");
		expect(edit("r", "z=#1", "-z")).toBe("111");
		expect(file("r.yaml")).toBe("a: \"12\"\nb: \"yes\"\nc: \"- x\"\nd: \"a: b\"\ne: \"%name%\"\nf: \"line\\nnext\"\ng: \"\"\nh: ~\ni:\n  - 1\n  - two\nj: {}\nk: \"!y[%d]!w\"\n");
		expect(dump("r").replaceAll(/@\d+:\d+/g, "")).toBe(before.replaceAll(/@\d+:\d+/g, ""));
	});
});

describe("one API for the three formats", () => {
	test("the same settings in YAML, JSON and INI read the same", async () => {
		const { get } = await boot({
			"a.yaml": "chat:\n  prefix: \"[HNS]\"\n  rules:\n    - Be nice\n    - No cheats\nround:\n  time: 2.5\nhud:\n  enabled: true\n",
			"b.json": "{\n  \"chat\": {\n    \"prefix\": \"[HNS]\",\n    \"rules\": [\"Be nice\", \"No cheats\"],\n  },\n  \"round\": { \"time\": 2.5 },\n  \"hud\": { \"enabled\": true },\n}\n",
			"c.ini": "[chat]\nprefix = [HNS]\nrules = \"Be nice\" \"No cheats\"\n\n[round]\ntime = 2.5\n\n[hud]\nenabled = 1\n",
		});
		for (const name of ["a", "b", "c"]) {
			expect(get(name, "chat.prefix")).toBe("[HNS]|-1|false/true|[HNS]|true||0");
			expect(get(name, "chat.rules").split("|").slice(3)).toEqual(["Be nice,No cheats", "true", "", "2"]);
			expect(get(name, "round.time").split("|")[1]).toBe("2.5");
			expect(get(name, "hud.enabled").split("|")[2]).toBe("true/true");
			expect(get(name, "hud.missing")).toBe("-|-1|false/true||false||0");
		}
	});

	test("true and false are read by one rule: yes, on, true, no, off, false in any case, or a number", async () => {
		const { get } = await boot({ "b.ini": "[S]\nA = Yes\nB = OFF\nC = 2\nD = 0.5\nE = 0\nF = true\nG = 1abc\nH = maybe\n" });
		const boolean = (key: string) => get("b", `S.${key}`).split("|")[2];
		expect(["A", "B", "C", "D", "E", "F", "G", "H"].map(boolean)).toEqual([
			"true/true",
			"false/false",
			"true/true",
			"true/true",
			"false/false",
			"true/true",
			"true/true", // a number first, as getNumber() reads it
			"false/true",
		]);
	});
});
