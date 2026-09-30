// The tooltips of src/types.ts, in both languages: scripts/apply-docs.ts writes the
// one AMXTS_DOCS_LANG picks into the JSDoc above each element.
export default {
	"ConfigCoreOptions": {
		en: `Config Core's options: \`configs\` in \`amxts.config.ts\`.`,
		ru: `Настройки Config Core: \`configs\` в \`amxts.config.ts\`.`,
	},
	"ConfigCoreOptions.baseDir": {
		en: `The folder under \`configs/\` that names are loaded from, e.g. \`"myserver"\`; \`""\` is \`configs/\` itself.`,
		ru: `Папка внутри \`configs/\`, из которой загружаются файлы по имени, например \`"myserver"\`; \`""\` — сама \`configs/\`.`,
	},
	"ConfigFormat": {
		en: `A config file's format, one of \`"ini"\`, \`"yaml"\` (\`.yaml\`, \`.yml\`) or \`"json"\` (\`.json\`, \`.jsonc\`).`,
		ru: `Формат файла конфига, одно из \`"ini"\`, \`"yaml"\` (\`.yaml\`, \`.yml\`) или \`"json"\` (\`.json\`, \`.jsonc\`).`,
	},
	"ConfigKind": {
		en: `A config value's kind, one of \`"object"\`, \`"array"\`, \`"string"\`, \`"number"\`, \`"boolean"\` or \`"null"\` - the kinds of JSON.`,
		ru: `Вид значения конфига, одно из \`"object"\`, \`"array"\`, \`"string"\`, \`"number"\`, \`"boolean"\` или \`"null"\` — виды JSON.`,
	},
};
