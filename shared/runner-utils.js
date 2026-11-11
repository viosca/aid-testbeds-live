/**
 * AID-Testbeds-Live: Common Testbed Runner Utilities
 */

const crypto = require("crypto");

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function sendTurn(client, advId, advShortId, text, type = "do") {
    const key = crypto.randomUUID();
    console.log(`\n  >>> Action: [${type}] "${text}"`);
    await client.actionRequest({ adventureId: advId, type, text, key });

    for (let i = 0; i < 40; i++) {
        await sleep(1000);
        const chk = await client.checkActionRequest({ adventureId: advId, key });
        if (!chk.isProcessing) break;
    }

    const updated = await client.getAdventure(advShortId);
    const lastActions = (updated.actionWindow || []).slice(-2);
    for (const a of lastActions) {
        console.log(`  <<< [${a.type}]: ${a.text.trim()}`);
    }
    return updated;
}

async function driveContinues(client, advId, advShortId, maxTurns = 6) {
    console.log("\n  Driving continue turns for background generation/thought cycles...");
    for (let i = 1; i <= maxTurns; i++) {
        const updated = await sendTurn(client, advId, advShortId, "", "continue");
        const lastAction = (updated.actionWindow || []).slice(-1)[0];
        if (lastAction && !lastAction.text.includes("please select \"continue\"")) {
            break;
        }
    }
}

module.exports = {
    sleep,
    sendTurn,
    driveContinues
};
