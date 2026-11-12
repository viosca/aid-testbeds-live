/**
 * AID-Testbeds-Live: Dual-Script Waterfall Regression Testbed
 * 
 * Verifies multi-script sequential execution across both primary deployment modes:
 *  - Case 1: Scenario Creator Setup (Built-in Router + Attached Script)
 *  - Case 3: Player/Host Setup (Blank Scenario + Dual Attached Scripts)
 */

const fs = require("fs");
const assert = require("assert");
const { AIDClient } = require("aid-connector");
const { sendTurn } = require("../../shared/runner-utils");

async function runCase1(client) {
    console.log("\n==================================================================");
    console.log("  RUNNING CASE 1: Built-in Router + Attached Entity-Cards v2.8.0");
    console.log("==================================================================");

    const modLib = fs.readFileSync("C:/git/aid-modules/library-aid-modules.js", "utf8");
    let getoptLib = fs.readFileSync("C:/git/aid-getopt/examples/library-sandbox.js", "utf8");
    const splitStart = getoptLib.indexOf("// Command 1: /roll");
    const splitEnd = getoptLib.indexOf("// Command 4: /help");
    if (splitStart !== -1 && splitEnd !== -1) {
        getoptLib = getoptLib.slice(0, splitStart) + getoptLib.slice(splitEnd);
    }

    const glueCode = `
if (typeof globalThis !== "undefined" && globalThis.AID) {
    if (globalThis.AID_MODULES) {
        for (const [key, rawRec] of Object.entries(globalThis.AID_MODULES)) {
            if (rawRec && typeof rawRec === "object" && !globalThis.AID.has(key)) {
                globalThis.AID.register(rawRec);
            }
        }
    }
    if (typeof globalThis.AID.slashCommand === "function" && typeof app !== "undefined") {
        globalThis.AID.slashCommand(app);
    }
}
`;

    const sharedLib = [modLib, getoptLib, glueCode].join("\n");
    const inputCode = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("input", text);
    }
    return { text };
};
modifier(text);`;

    const contextCode = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        [text, stop] = GetoptSandbox("context", text, stop);
    }
    return { text, stop };
};
modifier(text);`;

    const outputCode = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("output", text);
    }
    return { text };
};
modifier(text);`;

    const scnRes = await client.createScenario({
        title: "[TEST] Waterfall Case 1 Regression",
        description: "Case 1 Regression Scenario",
        prompt: "The cold mountain wind howls through the valley.",
        scriptsEnabled: true,
        gameCode: {
            sharedLibrary: sharedLib,
            onInput: inputCode,
            onModelContext: contextCode,
            onOutput: outputCode
        }
    });
    const scnId = scnRes.scenario.shortId;
    await client.updateScenario({ shortId: scnId, scriptsEnabled: true });
    await client.attachScenarioScript(scnId, "05_w3s9zrrvt");

    const advRes = await client.playAdventure(scnId);
    const adv = advRes.adventure;
    console.log(`Case 1 Adventure: ${adv.shortId} (ID: ${adv.id})`);

    const advScripts = await client.getAdventureScripts(adv.shortId);
    for (const s of advScripts) {
        if (!s.enabled) await client.setAdventureScriptEnabled(adv.shortId, s.shortId, true);
    }

    // Step 1: Upstream interception
    console.log("\n[Test 1.1] Upstream Router Interception & Early Halting (/aid-getopt --diag)");
    const diagTurn = await sendTurn(client, adv.id, adv.shortId, "/aid-getopt --diag");
    const diagText = diagTurn.actionWindow.slice(-1)[0]?.text || "";
    assert(diagText.includes("AID-Getopt System Diagnostics"), "Case 1 Test 1.1 Failed: diagnostics banner missing.");
    console.log("  ✓ /aid-getopt --diag successfully intercepted and halted by Script 1.");

    // Step 2: Cross-script command passthrough
    console.log("\n[Test 1.2] Downstream Script Initialization & Card Creation (/ec)");
    await sendTurn(client, adv.id, adv.shortId, "/ec");
    await sendTurn(client, adv.id, adv.shortId, `/ec -loc "Oakhaven Post" / {A secluded timber outpost}`);

    const cardsRes = await client.request("GetCards", `query GetCards($id: String!) { adventure(shortId: $id) { storyCards { id title type } } }`, { id: adv.shortId });
    const hasConfig = cardsRes.adventure.storyCards.some(c => c.title.includes("Auto-Cards") || c.title.includes("Entity Cards"));
    assert(hasConfig, "Case 1 Test 1.2 Failed: Entity-Cards failed to generate configuration story cards.");
    console.log("  ✓ /ec passed through Script 1 and generated cards in Script 2.");

    // Step 3: Narrative passthrough
    console.log("\n[Test 1.3] Clean Narrative Story Passthrough");
    const storyTurn = await sendTurn(client, adv.id, adv.shortId, "You walk toward the entrance in the snow.");
    const storyText = storyTurn.actionWindow.slice(-1)[0]?.text || "";
    assert(storyText.length > 2, "Case 1 Test 1.3 Failed: Story narrative produced no LLM output.");
    console.log("  ✓ Story narrative passed cleanly through both modifier layers.");
    console.log("\n>>> CASE 1 PASSED 100% <<<");
}

async function runCase3(client) {
    console.log("\n==================================================================");
    console.log("  RUNNING CASE 3: Blank Host + Dual Attached Scripts");
    console.log("==================================================================");

    const scnRes = await client.createScenario({
        title: "[TEST] Waterfall Case 3 Regression",
        prompt: "The alpine wind sweeps over the snowfields.",
        scriptsEnabled: true
    });
    const hostId = scnRes.scenario.shortId;
    await client.updateScenario({ shortId: hostId, scriptsEnabled: true });

    // Attach both scripts
    await client.attachScenarioScript(hostId, "Ka2D5sBoDFnn"); // AID-Getopt Router
    await client.attachScenarioScript(hostId, "05_w3s9zrrvt");  // Entity-Cards v2.8.0

    const advRes = await client.playAdventure(hostId);
    const adv = advRes.adventure;
    console.log(`Case 3 Adventure: ${adv.shortId} (ID: ${adv.id})`);

    const advScripts = await client.getAdventureScripts(adv.shortId);
    for (const s of advScripts) {
        if (!s.enabled) await client.setAdventureScriptEnabled(adv.shortId, s.shortId, true);
    }

    // Step 1: Upstream interception
    console.log("\n[Test 3.1] Upstream Attached Router Interception & Early Halting (/aid-getopt --diag)");
    const diagTurn = await sendTurn(client, adv.id, adv.shortId, "/aid-getopt --diag");
    const diagText = diagTurn.actionWindow.slice(-1)[0]?.text || "";
    assert(diagText.includes("AID-Getopt System Diagnostics"), "Case 3 Test 3.1 Failed: diagnostics banner missing.");
    console.log("  ✓ /aid-getopt --diag successfully intercepted and halted by Attached Script 1.");

    // Step 2: Cross-script command passthrough
    console.log("\n[Test 3.2] Cross-Script Routing Across Dual Attached Scripts (/ec)");
    await sendTurn(client, adv.id, adv.shortId, "/ec");
    await sendTurn(client, adv.id, adv.shortId, `/ec -loc "Pinecrest Inn" / {A warm alpine lodge}`);

    const cardsRes = await client.request("GetCards", `query GetCards($id: String!) { adventure(shortId: $id) { storyCards { id title type } } }`, { id: adv.shortId });
    const hasConfig = cardsRes.adventure.storyCards.some(c => c.title.includes("Auto-Cards") || c.title.includes("Entity Cards"));
    assert(hasConfig, "Case 3 Test 3.2 Failed: Entity-Cards failed to generate configuration story cards.");
    console.log("  ✓ /ec passed through Attached Script 1 and generated cards in Attached Script 2.");

    // Step 3: Narrative passthrough
    console.log("\n[Test 3.3] Clean Narrative Story Passthrough Across Dual Attached Scripts");
    const storyTurn = await sendTurn(client, adv.id, adv.shortId, "You open the wooden door and step inside.");
    const storyText = storyTurn.actionWindow.slice(-1)[0]?.text || "";
    assert(storyText.length > 2, "Case 3 Test 3.3 Failed: Story narrative produced no LLM output.");
    console.log("  ✓ Story narrative passed cleanly through both attached modifier layers.");
    console.log("\n>>> CASE 3 PASSED 100% <<<");
}

async function main() {
    const client = new AIDClient();
    console.log("Starting Full Waterfall Regression Suite...");
    await runCase1(client);
    await runCase3(client);
    console.log("\n==================================================================");
    console.log("  🎉 ALL WATERFALL REGRESSION TESTS PASSED (CASE 1 & CASE 3)");
    console.log("==================================================================");
}

main().catch(err => {
    console.error("\n❌ Regression Test Failure:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
