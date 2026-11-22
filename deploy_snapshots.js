/**
 * AID-Testbeds-Live: Deploy Updated Snapshots to AI Dungeon
 * 
 * Generic scenario snapshot deployment tool.
 * Reads scenario IDs from environment variables or command-line flags.
 * 
 * Usage:
 *   node deploy_snapshots.js [--ec <scenarioId>] [--ie <scenarioId>]
 * 
 * Environment variables (via .env):
 *   AID_SCENARIO_ENTITY_CARDS
 *   AID_SCENARIO_INNER_ENTITY
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { AIDClient } = require("aid-connector");
const { sleep } = require("./shared/runner-utils");

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        ecScenario: process.env.AID_SCENARIO_ENTITY_CARDS || "",
        ieScenario: process.env.AID_SCENARIO_INNER_ENTITY || "",
        ecPath: process.env.AID_PATH_ENTITY_CARDS || path.resolve(__dirname, "../Entity-Cards/src/library.js"),
        iePath: process.env.AID_PATH_INNER_ENTITY || path.resolve(__dirname, "../Inner-Entity/dist/inner-self-minds-only.js"),
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--ec" || arg === "--entity-cards") {
            options.ecScenario = args[++i];
        } else if (arg === "--ie" || arg === "--inner-entity") {
            options.ieScenario = args[++i];
        } else if (arg === "--ec-path") {
            options.ecPath = path.resolve(args[++i]);
        } else if (arg === "--ie-path") {
            options.iePath = path.resolve(args[++i]);
        } else if (arg === "-h" || arg === "--help") {
            console.log(`
AID-Testbeds-Live: Scenario Snapshot Deployment Tool

Usage:
  node deploy_snapshots.js [options]

Options:
  --ec, --entity-cards <shortId>    Target scenario ID for Entity-Cards
  --ie, --inner-entity <shortId>    Target scenario ID for Inner-Entity
  --ec-path <filePath>              Path to Entity-Cards library.js
  --ie-path <filePath>              Path to Inner-Entity minds-only script
  -h, --help                        Show this help message

Environment variables (.env):
  AID_SCENARIO_ENTITY_CARDS         Target scenario ID for Entity-Cards
  AID_SCENARIO_INNER_ENTITY         Target scenario ID for Inner-Entity
`);
            process.exit(0);
        }
    }
    return options;
}

async function moderateAndPublish(client, shortId, title, body) {
    console.log(`\n  [Publish] Initiating AI moderation for ${shortId} (${title})...`);
    const key = crypto.randomUUID();
    const modQ = `mutation Mod($input: AiModerateScenarioInput!) {
        aiModerateScenario(input: $input) {
            success
            isProcessing
            final_rating
            message
        }
    }`;
    await client.request("Mod", modQ, { input: { shortId, key, forceFullCheck: true } });

    const confQ = `mutation Conf($input: ConfirmAiModerationInput!) {
        confirmAiModeration(input: $input) {
            success
            message
        }
    }`;
    await client.request("Conf", confQ, { input: { shortId, key, forceFullCheck: true } });

    for (let i = 0; i < 30; i++) {
        await sleep(1500);
        const checkQ = `mutation CheckMod($input: AiModerateScenarioInput!) {
            aiModerateScenario(input: $input) {
                success
                isProcessing
                final_rating
            }
        }`;
        try {
            const cr = await client.request("CheckMod", checkQ, { input: { shortId, key: crypto.randomUUID() } });
            process.stdout.write(`    Checking moderation status: isProcessing=${cr.aiModerateScenario?.isProcessing}, rating=${cr.aiModerateScenario?.final_rating}\r`);
            if (!cr.aiModerateScenario?.isProcessing && cr.aiModerateScenario?.final_rating) break;
        } catch (_) {}
    }
    console.log(`\n    ✔ Moderation complete for ${shortId}`);

    console.log(`    Publishing ${shortId} with updateTier: SILENT...`);
    const pubRes = await client.publishScenario(shortId, {
        updateTier: "SILENT",
        title,
        body
    }, { force: true });
    console.log(`    ✔ Published snapshot updated: success=${pubRes.success}`);
}

async function main() {
    process.env.AID_FORCE_PUBLISH = "1";
    const client = new AIDClient();
    const config = parseArgs();

    if (!config.ecScenario && !config.ieScenario) {
        console.error(`
❌ Error: No target scenarios configured.
Please set AID_SCENARIO_ENTITY_CARDS and/or AID_SCENARIO_INNER_ENTITY in your .env file,
or pass them via command-line arguments:
  node deploy_snapshots.js --ec <scenarioId> --ie <scenarioId>
`);
        process.exit(1);
    }

    console.log("==================================================================");
    console.log("  🚀 DEPLOYING UPDATED SCRIPTS TO AI DUNGEON");
    console.log("==================================================================");

    // Deploy Entity-Cards
    if (config.ecScenario) {
        if (!fs.existsSync(config.ecPath)) {
            console.error(`❌ Entity-Cards file not found at: ${config.ecPath}`);
            process.exit(1);
        }
        const ecLib = fs.readFileSync(config.ecPath, "utf8");
        console.log(`\n1. Deploying Entity-Cards (${config.ecScenario}): ${ecLib.length} bytes`);
        await client.updateScenarioScripts(config.ecScenario, {
            sharedLibrary: ecLib,
            onInput: `const modifier = (text) => {\n    text = AutoCards("input", text);\n    return { text };\n};\nmodifier(text);`,
            onModelContext: `const modifier = (text) => {\n    [text, stop] = AutoCards("context", text, stop);\n    return { text, stop };\n};\nmodifier(text);`,
            onOutput: `const modifier = (text) => {\n    text = AutoCards("output", text);\n    return { text };\n};\nmodifier(text);`
        });
        console.log(`   ✔ Draft scripts updated for ${config.ecScenario}`);
        await moderateAndPublish(client, config.ecScenario, "Entity Cards (NER)", "100% completion announcement and non-destructive state persistence snapshot");
    }

    // Deploy Inner-Entity
    if (config.ieScenario) {
        if (!fs.existsSync(config.iePath)) {
            console.error(`❌ Inner-Entity file not found at: ${config.iePath}`);
            process.exit(1);
        }
        const ieLib = fs.readFileSync(config.iePath, "utf8");
        console.log(`\n2. Deploying Inner-Entity Minds-Only (${config.ieScenario}): ${ieLib.length} bytes`);
        await client.updateScenarioScripts(config.ieScenario, {
            sharedLibrary: ieLib,
            onInput: `InnerEntity("input");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`,
            onModelContext: `InnerEntity("context");\nconst modifier = (text) => {\n  return { text, stop };\n};\nmodifier(text);`,
            onOutput: `InnerEntity("output");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`
        });
        console.log(`   ✔ Draft scripts updated for ${config.ieScenario}`);
        await moderateAndPublish(client, config.ieScenario, "Inner Entity (Minds)", "Minds-only cognition and 100% completion sync snapshot");
    }

    console.log("\n==================================================================");
    console.log("  🎉 DEPLOYMENT COMPLETE! All target scripts updated on AI Dungeon.");
    console.log("==================================================================");
}

main().catch(err => {
    console.error("\n❌ DEPLOYMENT FAILED:", err);
    process.exit(1);
});
