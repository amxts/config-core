plugin({ name: "Rules", version: "1.0.0", author: "you", description: "Rules from a YAML, JSON or INI file" });

// configs/rules.yaml - or rules.ini, rules.yml, rules.json, rules.jsonc:
// whichever is there. Read on each /rules, so an edit shows at once.
server.addCommand("/rules", (player) => {
	const rules = configs.load("rules", {
		chat: { prefix: "[Server]", rules: ["Be nice"] },
		stats: { shown: 0 },
	});
	for (const rule of rules.chat.rules) print(player, `${rules.chat.prefix} ${rule}`);

	rules.stats.shown++;
	configs.save(rules);
});
