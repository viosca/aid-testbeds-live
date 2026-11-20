/**
 * AID-Testbeds-Live: CSCP v1.1.0 4-Slot Grand Waterfall Regression Testbed
 * 
 * Verifies live QuickJS execution across 4 isolated VM slots:
 *  1. Slot 1: AID-Modules      (jHwEbn7_bYGC) -> CSCP Bus Host & 16-VS DLL Carrier
 *  2. Slot 2: AID-Getopt       (Ka2D5sBoDFnn) -> CLI Router & /help Aggregator
 *  3. Slot 3: Entity-Cards     (05_w3s9zrrvt) -> Named Entity Recognition
 *  4. Slot 4: Inner-Entity     (bL_qS9DsI5wI) -> Minds-Only Character Cognition
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { AIDClient } = require("aid-connector");
const { sendTurn, sleep } = require("../../shared/runner-utils");

async function main() {
    const client = new AIDClient();

    console.log("==================================================================");
    console.log("  🚀 TESTBED: CSCP v1.1.0 4-SLOT GRAND WATERFALL (LIVE QUICKJS)");
    console.log("  Cascade: AID-Modules -> AID-Getopt -> Entity-Cards -> Inner-Entity");
    console.log("==================================================================");

    // 1. Read latest local builds on feat/cscp
    console.log("\n1. Reading latest local distribution artifacts...");
    const modLib = fs.readFileSync("C:/git/aid-modules/library-aid-modules.js", "utf8");
    const getoptLib = fs.readFileSync("C:/git/aid-getopt/examples/library-sandbox.js", "utf8");
    const ecLib = fs.readFileSync("C:/git/Entity-Cards/src/library.js", "utf8");
    const ieLib = fs.readFileSync("C:/git/Inner-Entity/dist/inner-self-minds-only.js", "utf8");

    console.log(`  ✔ AID-Modules:   ${modLib.length} bytes`);
    console.log(`  ✔ AID-Getopt:    ${getoptLib.length} bytes`);
    console.log(`  ✔ Entity-Cards:  ${ecLib.length} bytes`);
    console.log(`  ✔ Inner-Entity:  ${ieLib.length} bytes`);

    // 2. Deploy latest code to unpublished draft scripts on AI Dungeon
    console.log("\n2. Deploying latest builds to unpublished draft scripts on AI Dungeon...");

    console.log("  Deploying Script 1: AID-Modules (jHwEbn7_bYGC)...");
    await client.updateScenarioScripts("jHwEbn7_bYGC", {
        sharedLibrary: modLib,
        onInput: `const modifier = (text) => {\n    if (typeof AID === "object" && typeof AID.input === "function") {\n        text = AID.input(text);\n    }\n    return { text };\n};\nmodifier(text);`,
        onModelContext: `const modifier = (text) => {\n    if (typeof AID === "object" && typeof AID.context === "function") {\n        [text, stop] = AID.context(text, stop);\n    }\n    return { text, stop };\n};\nmodifier(text);`,
        onOutput: `const modifier = (text) => {\n    if (typeof AID === "object" && typeof AID.output === "function") {\n        text = AID.output(text);\n    }\n    return { text };\n};\nmodifier(text);`
    });

    console.log("  Deploying Script 2: AID-Getopt Router (Ka2D5sBoDFnn)...");
    await client.updateScenarioScripts("Ka2D5sBoDFnn", {
        sharedLibrary: getoptLib,
        onInput: `const modifier = (text) => {\n    if (typeof GetoptSandbox === "function") {\n        text = GetoptSandbox("input", text);\n    }\n    return { text };\n};\nmodifier(text);`,
        onModelContext: `const modifier = (text) => {\n    if (typeof GetoptSandbox === "function") {\n        [text, stop] = GetoptSandbox("context", text, stop);\n    }\n    return { text, stop };\n};\nmodifier(text);`,
        onOutput: `const modifier = (text) => {\n    if (typeof GetoptSandbox === "function") {\n        text = GetoptSandbox("output", text);\n    }\n    return { text };\n};\nmodifier(text);`
    });

    console.log("  Deploying Script 3: Entity-Cards v2.8.0-EC (05_w3s9zrrvt)...");
    await client.updateScenarioScripts("05_w3s9zrrvt", {
        sharedLibrary: ecLib,
        onInput: `const modifier = (text) => {\n    text = AutoCards("input", text);\n    return { text };\n};\nmodifier(text);`,
        onModelContext: `const modifier = (text) => {\n    [text, stop] = AutoCards("context", text, stop);\n    return { text, stop };\n};\nmodifier(text);`,
        onOutput: `const modifier = (text) => {\n    text = AutoCards("output", text);\n    return { text };\n};\nmodifier(text);`
    });

    console.log("  Deploying Script 4: Inner Entity v2.8.0-IE Minds-Only (bL_qS9DsI5wI)...");
    await client.updateScenarioScripts("bL_qS9DsI5wI", {
        sharedLibrary: ieLib,
        onInput: `InnerEntity("input");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`,
        onModelContext: `InnerEntity("context");\nconst modifier = (text) => {\n  return { text, stop };\n};\nmodifier(text);`,
        onOutput: `InnerEntity("output");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`
    });
    console.log("  ✔ All 4 scripts successfully updated in draft mode.");

    // 3. Create host scenario and attach 4 scripts
    console.log("\n3. Spawning Host Scenario with 4 Attached Waterfall Scripts...");
    const scnRes = await client.createScenario({
        title: "[TEST] CSCP 4-Slot Grand Waterfall",
        description: "Automated regression testbed for CSCP v1.1.0 4-slot cascade",
        prompt: "The cold mountain wind howls across the snowy ridge near the dwarven forge.",
        scriptsEnabled: true
    });
    const hostId = scnRes.scenario.shortId;
    console.log(`  Host Scenario ID: ${hostId}`);

    console.log("  Attaching Slot 1: AID-Modules (jHwEbn7_bYGC)...");
    await client.attachScenarioScript(hostId, "jHwEbn7_bYGC");
    console.log("  Attaching Slot 2: AID-Getopt (Ka2D5sBoDFnn)...");
    await client.attachScenarioScript(hostId, "Ka2D5sBoDFnn");
    console.log("  Attaching Slot 3: Entity-Cards (05_w3s9zrrvt)...");
    await client.attachScenarioScript(hostId, "05_w3s9zrrvt");
    console.log("  Attaching Slot 4: Inner-Entity (bL_qS9DsI5wI)...");
    await client.attachScenarioScript(hostId, "bL_qS9DsI5wI");

    // 4. Start Adventure
    console.log("\n4. Starting Test Adventure from 4-Slot Scenario...");
    const advRes = await client.playAdventure(hostId);
    const adv = advRes.adventure;
    console.log(`  Adventure: ${adv.shortId} (ID: ${adv.id})`);

    // Verify scripts on adventure
    const advScripts = await client.getAdventureScripts(adv.shortId);
    console.log(`  Discovered ${advScripts.length} attached scripts on adventure:`);
    for (const s of advScripts) {
        console.log(`   - ${s.title || s.shortId} (ID: ${s.shortId}) [enabled: ${s.enabled}]`);
        if (!s.enabled) {
            await client.setAdventureScriptEnabled(adv.shortId, s.shortId, true);
        }
    }

    const getTurnText = (a) => (a.actionWindow || []).slice(-2).map(act => act.text).join("\n");

    // 5. Verification Turn 1: Slot 1 AID-Modules inspection
    console.log("\n==================================================================");
    console.log("  [Step 5.1] Slot 1: /aid-modules -v");
    console.log("==================================================================");
    const t1 = await sendTurn(client, adv.id, adv.shortId, "/aid-modules -v");
    const t1Text = getTurnText(t1);
    console.log("  Result:\n" + t1Text);
    assert(t1Text.includes("aid-modules") || t1Text.includes("Active AI Dungeon Modules"), "Step 5.1 Failed: AID-Modules output missing");

    // 6. Verification Turn 2: Slot 2 Master /help Aggregation via CSCP
    console.log("\n==================================================================");
    console.log("  [Step 5.2] Slot 2: Master /help Directory Aggregation via CSCP");
    console.log("==================================================================");
    const t2 = await sendTurn(client, adv.id, adv.shortId, "/help");
    const t2Text = getTurnText(t2);
    console.log("  Result:\n" + t2Text);

    // 7. Verification Turn 3: Slot 2 Cascade Diagnostics (/aid-getopt --diag)
    console.log("\n==================================================================");
    console.log("  [Step 5.3] Slot 2: /aid-getopt --diag Waterfall Inspection");
    console.log("==================================================================");
    const t3 = await sendTurn(client, adv.id, adv.shortId, "/aid-getopt --diag");
    const t3Text = getTurnText(t3);
    console.log("  Result:\n" + t3Text);

    // 8. Verification Turn 4: Slot 3 Entity-Cards version & info
    console.log("\n==================================================================");
    console.log("  [Step 5.4] Slot 3: /ec -v (Entity-Cards via Waterfall)");
    console.log("==================================================================");
    const t4 = await sendTurn(client, adv.id, adv.shortId, "/ec -v");
    const t4Text = getTurnText(t4);
    console.log("  Result:\n" + t4Text);
    assert(t4Text.includes("/EC version") || t4Text.includes("EntityCards") || t4Text.includes("Entity Cards") || t4Text.includes("2.8.0"), "Step 5.4 Failed: EC version missing");

    // 9. Verification Turn 5: Slot 4 Inner-Entity version & info
    console.log("\n==================================================================");
    console.log("  [Step 5.5] Slot 4: /ie -v (Inner-Entity via Waterfall)");
    console.log("==================================================================");
    const t5 = await sendTurn(client, adv.id, adv.shortId, "/ie -v");
    const t5Text = getTurnText(t5);
    console.log("  Result:\n" + t5Text);
    assert(t5Text.includes("/IE version") || t5Text.includes("Inner Entity") || t5Text.includes("minds-only"), "Step 5.5 Failed: IE version missing");

    // 10. Verification Turn 6: Normal story turn & StoryCard inspection
    console.log("\n==================================================================");
    console.log("  [Step 5.6] Normal Narrative Turn & StoryCard Carrier Verification");
    console.log("==================================================================");
    const t6 = await sendTurn(client, adv.id, adv.shortId, "A travelling scholar named Thorin arrives at the gate, seeking shelter.");
    const t6Text = getTurnText(t6);
    assert(t6Text.length > 2, "Step 5.6 Failed: Story prose missing");

    // Fetch adventure story cards
    const cards = await client.getStoryCards(adv.shortId);
    console.log(`\n  Discovered ${cards.length} Story Cards in Adventure:`);
    for (const c of cards) {
        const hasDLL = typeof c.keys === "string" && c.keys.includes("\u200D\uFE00\u200D");
        const hasCSCP = typeof c.keys === "string" && c.keys.includes("\u200D\u200C\u200D");
        console.log(`   - "${c.title}" (type: ${c.type}) [DLL Carrier: ${hasDLL ? "YES (16-VS)" : "No"}, State Stamp: ${hasCSCP ? "YES" : "No"}]`);
    }

    const carrierCard = cards.find(c => c.title && c.title.includes("System Modules"));
    assert(carrierCard, "Step 5.6 Failed: 'Configure System Modules' carrier card was not created.");
    assert(carrierCard.keys.includes("\u200D\uFE00\u200D"), "Step 5.6 Failed: Carrier card does not contain 16-VS DLL.");
    console.log("  ✔ Carrier card 'Configure \\nSystem Modules' verified with 16-Variation-Selector DLL!");

    console.log("\n==================================================================");
    console.log("  🎉 ALL CSCP 4-SLOT GRAND WATERFALL LIVE TESTS PASSED (100% SUCCESS)!");
    console.log("==================================================================");
}

main().catch(err => {
    console.error("\n❌ LIVE TEST RUNNER FAILED:", err);
    process.exit(1);
});
