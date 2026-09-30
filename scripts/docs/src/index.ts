// The tooltips of src/index.ts, in both languages: scripts/apply-docs.ts writes the
// one AMXTS_DOCS_LANG picks into the JSDoc above each element.
export default {
	"setBaseDir": {
		en: `Sets the folder under \`configs/\` that file names are relative to, e.g. \`"myserver"\`; \`""\` is \`configs/\` itself.`,
		ru: `Задаёт папку внутри \`configs/\`, от которой считаются имена файлов, например \`"myserver"\`; \`""\` — сама \`configs/\`.`,
	},
	"load": {
		en: `
			Reads a config file into an object shaped like \`defaults\`: each value the
			file has, where it is of the right kind, and the default for the rest.
			The file is \`configs/<baseDir>/<name>\` - YAML, JSON or INI, whichever is
			there (\`resolve()\`). A value of the wrong kind, a name not in its union and
			a key the object does not have are said in the server console with the
			file, the line and the column. \`save()\` writes the object back.

			    const settings = configs.load("settings", {
			        chat: { prefix: "[HNS]" },
			        round: { time: 2.5 },
			    });
			    settings.round.time = 3;
			    configs.save(settings);
		`,
		ru: `
			Читает файл конфига в объект той же формы, что \`defaults\`: каждое значение,
			которое есть в файле и нужного вида, а для остальных — значение по умолчанию.
			Файл — \`configs/<baseDir>/<name>\`: YAML, JSON или INI, какой есть
			(\`resolve()\`). Значение не того вида, имя не из своего юниона и ключ,
			которого у объекта нет, называются в консоли сервера с файлом, строкой и
			столбцом. \`save()\` записывает объект обратно.

			    const settings = configs.load("settings", {
			        chat: { prefix: "[HNS]" },
			        round: { time: 2.5 },
			    });
			    settings.round.time = 3;
			    configs.save(settings);
		`,
	},
	"save": {
		en: `
			Writes an object \`load()\` read back into its file, in the file's format:
			comments on lines of their own stay where they were. \`false\` when it could
			not be written, or the object was not read by \`load()\`.
		`,
		ru: `
			Записывает объект, прочитанный \`load()\`, обратно в его файл, в формате
			файла: комментарии на отдельных строках остаются на месте. \`false\`, если
			записать не вышло или объект прочитан не через \`load()\`.
		`,
	},
	"ConfigNode": {
		en: `
			A value of a config file: an object, an array, text, a number, a boolean
			or \`null\`, with the place it was read from. \`read()\` gives the file's top
			value; a path leads into it: \`"chat.prefix"\`, \`"items[0].name"\`. For a file
			whose shape is not known beforehand; a config of a known shape is read
			into an object by \`load(name, defaults)\`.

			    const maps = configs.read("maps");
			    for (const map of maps.values()) if (map.getBoolean("enabled")) console.log(map.key);
		`,
		ru: `
			Значение файла конфига: объект, массив, текст, число, логическое значение
			или \`null\`, с местом, откуда оно прочитано. \`read()\` отдаёт верхнее значение
			файла; путь ведёт внутрь: \`"chat.prefix"\`, \`"items[0].name"\`. Для файла, форма
			которого заранее неизвестна; конфиг известной формы читается в объект
			через \`load(name, defaults)\`.

			    const maps = configs.read("maps");
			    for (const map of maps.values()) if (map.getBoolean("enabled")) console.log(map.key);
		`,
	},
	"ConfigNode.kind": {
		en: `The value's kind, one of \`"object"\`, \`"array"\`, \`"string"\`, \`"number"\`, \`"boolean"\` or \`"null"\`.`,
		ru: `Вид значения, одно из \`"object"\`, \`"array"\`, \`"string"\`, \`"number"\`, \`"boolean"\` или \`"null"\`.`,
	},
	"ConfigNode.key": {
		en: `The value's key in its object, e.g. \`"prefix"\`; \`""\` for an item of an array and for the top value.`,
		ru: `Ключ значения в его объекте, например \`"prefix"\`; \`""\` у элемента массива и у верхнего значения.`,
	},
	"ConfigNode.file": {
		en: `The path of the file the value was read from, e.g. \`"addons/amxmodx/configs/settings.yaml"\`; \`""\` for a text given to \`parse()\`.`,
		ru: `Путь файла, из которого прочитано значение, например \`"addons/amxmodx/configs/settings.yaml"\`; \`""\` — для текста, отданного \`parse()\`.`,
	},
	"ConfigNode.format": {
		en: `The file's format, one of \`"ini"\`, \`"yaml"\` or \`"json"\`.`,
		ru: `Формат файла, одно из \`"ini"\`, \`"yaml"\` или \`"json"\`.`,
	},
	"ConfigNode.line": {
		en: `The line the value - or its key - was read from, from \`1\`; \`0\` for a value set at run time.`,
		ru: `Строка, из которой прочитано значение — или его ключ, — с \`1\`; \`0\` — для значения, заданного во время работы.`,
	},
	"ConfigNode.column": {
		en: `The column the value - or its key - starts at, from \`1\`; \`0\` for a value set at run time and in an INI file.`,
		ru: `Столбец, с которого начинается значение — или его ключ, — с \`1\`; \`0\` — для значения, заданного во время работы, и в INI-файле.`,
	},
	"ConfigNode.get": {
		en: `The value a path leads to, e.g. \`"chat.prefix"\` or \`"items[0]"\`; \`null\` when there is none.`,
		ru: `Значение, к которому ведёт путь, например \`"chat.prefix"\` или \`"items[0]"\`; \`null\`, если его нет.`,
	},
	"ConfigNode.has": {
		en: `Whether a path leads to a value, \`null\` among them.`,
		ru: `Ведёт ли путь к значению, \`null\` в том числе.`,
	},
	"ConfigNode.keys": {
		en: `The keys of an object, in file order - of this one, or of the one a path leads to; [] for anything else.`,
		ru: `Ключи объекта в порядке файла — этого или того, к которому ведёт путь; [] для всего остального.`,
	},
	"ConfigNode.values": {
		en: `The items of an array or the values of an object, in file order - of this one, or of the one a path leads to; [] for anything else.`,
		ru: `Элементы массива или значения объекта в порядке файла — этого или того, к которому ведёт путь; [] для всего остального.`,
	},
	"ConfigNode.getString": {
		en: `A value as text: text as it is, a number as written, \`"true"\` or \`"false"\`; \`fallback\` (or \`""\`) for none, \`null\`, an object or an array.`,
		ru: `Значение как текст: текст как есть, число как записано, \`"true"\` или \`"false"\`; \`fallback\` (или \`""\`) — если значения нет, для \`null\`, объекта и массива.`,
	},
	"ConfigNode.getNumber": {
		en: `A value as a number: a number, or text that is one, e.g. \`"2.5"\`; \`fallback\` for anything else.`,
		ru: `Значение как число: число или текст, который им является, например \`"2.5"\`; \`fallback\` для всего остального.`,
	},
	"ConfigNode.getBoolean": {
		en: `A value as a boolean: \`true\` or \`false\`, a number (\`0\` is \`false\`), or text - \`"yes"\`, \`"no"\`, \`"on"\`, \`"off"\`, \`"true"\`, \`"false"\` in any case, or a number; \`fallback\` for anything else.`,
		ru: `Значение как логическое: \`true\` или \`false\`, число (\`0\` — ложь) или текст — \`"yes"\`, \`"no"\`, \`"on"\`, \`"off"\`, \`"true"\`, \`"false"\` в любом регистре или число; \`fallback\` для всего остального.`,
	},
	"ConfigNode.getStrings": {
		en: `A list of text: the text of each item of an array, or one value as a list of one; [] for none.`,
		ru: `Список текста: текст каждого элемента массива или одно значение как список из одного; [] — если значения нет.`,
	},
	"ConfigNode.set": {
		en: `Sets text at a path, making the objects - and the lists, before an item \`"[0]"\` - on the way; \`false\` where the path goes through a value that is not an object or a list.`,
		ru: `Записывает текст по пути, создавая по дороге объекты — и списки перед элементом \`"[0]"\`; \`false\`, если путь идёт через значение, которое не объект и не список.`,
	},
	"ConfigNode.setNumber": {
		en: `Sets a number at a path, as \`set()\` sets text.`,
		ru: `Записывает число по пути, как \`set()\` записывает текст.`,
	},
	"ConfigNode.setBoolean": {
		en: `Sets a boolean at a path, as \`set()\` sets text.`,
		ru: `Записывает логическое значение по пути, как \`set()\` записывает текст.`,
	},
	"ConfigNode.setStrings": {
		en: `Sets a list of text at a path, as \`set()\` sets text.`,
		ru: `Записывает список текста по пути, как \`set()\` записывает текст.`,
	},
	"ConfigNode.remove": {
		en: `Removes the value a path leads to; \`false\` when there was none.`,
		ru: `Удаляет значение, к которому ведёт путь; \`false\`, если его не было.`,
	},
	"ConfigNode.save": {
		en: `Writes the whole file back in its format, with the comments that were on lines of their own. \`false\` for a text given to \`parse()\`.`,
		ru: `Записывает весь файл обратно в его формате, с комментариями, которые стояли на отдельных строках. \`false\` для текста, отданного \`parse()\`.`,
	},
	"resolve": {
		en: `
			The file a name is read from by \`read()\`: the name, when it ends in \`.ini\`,
			\`.yaml\`, \`.yml\`, \`.json\` or \`.jsonc\`; else the first of \`name.ini\`, \`name.yaml\`,
			\`name.yml\`, \`name.json\` and \`name.jsonc\` that is there - two of them are an
			error in the server console - and \`name.yaml\` when none is.
		`,
		ru: `
			Файл, из которого \`read()\` читает имя: само имя, если оно кончается на \`.ini\`,
			\`.yaml\`, \`.yml\`, \`.json\` или \`.jsonc\`; иначе первый из \`name.ini\`, \`name.yaml\`,
			\`name.yml\`, \`name.json\` и \`name.jsonc\`, который есть, — два из них — ошибка
			в консоли сервера, — и \`name.yaml\`, если нет ни одного.
		`,
	},
	"read": {
		en: `
			Reads a config file from \`configs/<baseDir>/\` - INI, YAML or JSON - as a
			tree of values. A name without an extension finds the file (\`resolve()\`).
			A file that is not there reads as an empty object, to be filled and saved;
			one that cannot be read is reported in the server console with the line
			and the column, and reads as an empty object too. For a file whose shape
			is not known beforehand; a config of a known shape is read into an object
			by \`load(name, defaults)\`.

			    const maps = configs.read("maps");     // maps.ini, .yaml, .yml, .json or .jsonc
			    for (const key of maps.keys()) console.log(key);
		`,
		ru: `
			Читает файл конфига из \`configs/<baseDir>/\` — INI, YAML или JSON — как
			дерево значений. Имя без расширения находит файл (\`resolve()\`). Файла нет —
			читается пустой объект, чтобы его заполнить и сохранить; файл, который не
			прочитать, называется в консоли сервера со строкой и столбцом и тоже
			читается пустым объектом. Для файла, форма которого заранее неизвестна;
			конфиг известной формы читается в объект через \`load(name, defaults)\`.

			    const maps = configs.read("maps");     // maps.ini, .yaml, .yml, .json или .jsonc
			    for (const key of maps.keys()) console.log(key);
		`,
	},
	"parse": {
		en: `Reads a text in a format - \`"ini"\`, \`"yaml"\` or \`"json"\` - as \`read()\` reads a file; \`save()\` has no file to write it to.`,
		ru: `Читает текст в формате — \`"ini"\`, \`"yaml"\` или \`"json"\` — как \`read()\` читает файл; \`save()\` писать его некуда.`,
	},
};
