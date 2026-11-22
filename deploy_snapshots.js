/**
 * AID-Testbeds-Live: Deploy Updated Snapshots to AI Dungeon
 * 
 * Generic scenario snapshot deployment tool.
 * Reads scenario IDs from environment variables or command-line flags.
 * Automatically synchronizes titles, short descriptions, and long Markdown
 * descriptions from docs/AID_DESCRIPTION.md across repositories.
 * 
 * Usage:
 *   node deploy_snapshots.js [--ec <id>] [--ie <id>] [--modules <id>] [--getopt <id>] [--all]
 * 
 * Environment variables (via .env):
 *   AID_SCENARIO_ENTITY_CARDS
 *   AID_SCENARIO_INNER_ENTITY
 *   AID_SCENARIO_MODULES
 *   AID_SCENARIO_GETOPT
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { AIDClient } = require("aid-connector");
const { sleep } = require("./shared/runner-utils");

function parseAidDescription(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { advancedDescription: content };
    const frontmatter = match[1];
    const advancedDescription = match[2].trim();
    const meta = {};
    for (const line of frontmatter.split(/\r?\n/)) {
        const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (kv) {
            let val = kv[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            meta[kv[1]] = val;
        }
    }
    return {
        title: meta.title,
        description: meta.short_description || meta.description,
        version: meta.version,
        advancedDescription
    };
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        ecScenario: process.env.AID_SCENARIO_ENTITY_CARDS || "",
        ieScenario: process.env.AID_SCENARIO_INNER_ENTITY || "",
        modScenario: process.env.AID_SCENARIO_MODULES || "",
        optScenario: process.env.AID_SCENARIO_GETOPT || "",
        ecPath: process.env.AID_PATH_ENTITY_CARDS || path.resolve(__dirname, "../Entity-Cards/src/library.js"),
        iePath: process.env.AID_PATH_INNER_ENTITY || path.resolve(__dirname, "../Inner-Entity/dist/inner-self-minds-only.js"),
        modPath: process.env.AID_PATH_MODULES || path.resolve(__dirname, "../aid-modules/dist/library-aid-modules.js"),
        optPath: process.env.AID_PATH_GETOPT || path.resolve(__dirname, "../aid-getopt/dist/library-aid-getopt.js"),
        targets: new Set()
    };

    let hasExplicitTarget = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--ec" || arg === "--entity-cards") {
            hasExplicitTarget = true;
            options.targets.add("ec");
            if (args[i + 1] && !args[i + 1].startsWith("-")) options.ecScenario = args[++i];
        } else if (arg === "--ie" || arg === "--inner-entity") {
            hasExplicitTarget = true;
            options.targets.add("ie");
            if (args[i + 1] && !args[i + 1].startsWith("-")) options.ieScenario = args[++i];
        } else if (arg === "--modules" || arg === "--mod") {
            hasExplicitTarget = true;
            options.targets.add("mod");
            if (args[i + 1] && !args[i + 1].startsWith("-")) options.modScenario = args[++i];
        } else if (arg === "--getopt" || arg === "--opt") {
            hasExplicitTarget = true;
            options.targets.add("opt");
            if (args[i + 1] && !args[i + 1].startsWith("-")) options.optScenario = args[++i];
        } else if (arg === "--all") {
            hasExplicitTarget = true;
            options.targets.add("ec");
            options.targets.add("ie");
            options.targets.add("mod");
            options.targets.add("opt");
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
  --all                             Deploy all 4 configured modules
  --ec, --entity-cards [shortId]    Target scenario ID for Entity-Cards
  --ie, --inner-entity [shortId]    Target scenario ID for Inner-Entity
  --modules, --mod [shortId]        Target scenario ID for AID-Modules
  --getopt, --opt [shortId]         Target scenario ID for AID-Getopt
  --ec-path <filePath>              Path to Entity-Cards library.js
  --ie-path <filePath>              Path to Inner-Entity minds-only script
  -h, --help                        Show this help message

Environment variables (.env):
  AID_SCENARIO_ENTITY_CARDS         Target scenario ID for Entity-Cards
  AID_SCENARIO_INNER_ENTITY         Target scenario ID for Inner-Entity
  AID_SCENARIO_MODULES              Target scenario ID for AID-Modules
  AID_SCENARIO_GETOPT               Target scenario ID for AID-Getopt
`);
            process.exit(0);
        }
    }

    // Default to deploying ec and ie if no explicit target passed
    if (!hasExplicitTarget) {
        if (options.ecScenario) options.targets.add("ec");
        if (options.ieScenario) options.targets.add("ie");
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

    if (config.targets.size === 0) {
        console.error(`
❌ Error: No target scenarios configured.
Please set AID_SCENARIO_* in your .env file or pass them via CLI.
`);
        process.exit(1);
    }

    console.log("==================================================================");
    console.log("  🚀 DEPLOYING UPDATED SCRIPTS & METADATA TO AI DUNGEON");
    console.log("==================================================================");

    // 1. Deploy AID-Modules
    if (config.targets.has("mod") && config.modScenario) {
        if (!fs.existsSync(config.modPath)) {
            console.error(`❌ AID-Modules file not found at: ${config.modPath}`);
            process.exit(1);
        }
        const lib = fs.readFileSync(config.modPath, "utf8");
        const docMeta = parseAidDescription(path.resolve(__dirname, "../aid-modules/docs/AID_DESCRIPTION.md")) || {};
        console.log(`\n1. Deploying AID-Modules (${config.modScenario}): ${lib.length} bytes`);
        await client.updateScenario({
            shortId: config.modScenario,
            title: docMeta.title || "AID-Modules",
            description: docMeta.description || "Standard module registry and dependency management for AI Dungeon scripts",
            advancedDescription: docMeta.advancedDescription || undefined,
            isScript: true,
            scriptsEnabled: true
        });
        await client.updateScenarioScripts(config.modScenario, {
            sharedLibrary: lib,
            onInput: `const modifier = (text) => { return { text }; };\nmodifier(text);`,
            onModelContext: `const modifier = (text) => { return { text, stop }; };\nmodifier(text);`,
            onOutput: `const modifier = (text) => { return { text }; };\nmodifier(text);`
        });
        console.log(`   ✔ Draft scripts & metadata updated for ${config.modScenario}`);
        await moderateAndPublish(client, config.modScenario, docMeta.title || "AID-Modules", "Module registry and AMS v1.1.0 update snapshot");
    }

    // 2. Deploy AID-Getopt
    if (config.targets.has("opt") && config.optScenario) {
        if (!fs.existsSync(config.optPath)) {
            console.error(`❌ AID-Getopt file not found at: ${config.optPath}`);
            process.exit(1);
        }
        const lib = fs.readFileSync(config.optPath, "utf8");
        const docMeta = parseAidDescription(path.resolve(__dirname, "../aid-getopt/docs/AID_DESCRIPTION.md")) || {};
        console.log(`\n2. Deploying AID-Getopt (${config.optScenario}): ${lib.length} bytes`);
        await client.updateScenario({
            shortId: config.optScenario,
            title: docMeta.title || "AID-Getopt Router",
            description: docMeta.description || "POSIX/GNU option parser & multi-script slash command router",
            advancedDescription: docMeta.advancedDescription || undefined,
            isScript: true,
            scriptsEnabled: true
        });
        await client.updateScenarioScripts(config.optScenario, {
            sharedLibrary: lib,
            onInput: `const modifier = (text) => { return { text }; };\nmodifier(text);`,
            onModelContext: `const modifier = (text) => { return { text, stop }; };\nmodifier(text);`,
            onOutput: `const modifier = (text) => { return { text }; };\nmodifier(text);`
        });
        console.log(`   ✔ Draft scripts & metadata updated for ${config.optScenario}`);
        await moderateAndPublish(client, config.optScenario, docMeta.title || "AID-Getopt Router", "POSIX/GNU router and smart dash tolerance update snapshot");
    }

    // 3. Deploy Entity-Cards
    if (config.targets.has("ec") && config.ecScenario) {
        if (!fs.existsSync(config.ecPath)) {
            console.error(`❌ Entity-Cards file not found at: ${config.ecPath}`);
            process.exit(1);
        }
        const ecLib = fs.readFileSync(config.ecPath, "utf8");
        const docMeta = parseAidDescription(path.resolve(__dirname, "../Entity-Cards/docs/AID_DESCRIPTION.md")) || {};
        console.log(`\n3. Deploying Entity-Cards (${config.ecScenario}): ${ecLib.length} bytes`);
        await client.updateScenario({
            shortId: config.ecScenario,
            title: docMeta.title || "Entity Cards (NER)",
            description: docMeta.description || "Automated Named Entity Recognition (NER), MBTI character profiles, and structured lore generation",
            advancedDescription: docMeta.advancedDescription || undefined,
            isScript: true,
            scriptsEnabled: true
        });
        await client.updateScenarioScripts(config.ecScenario, {
            sharedLibrary: ecLib,
            onInput: `const modifier = (text) => {\n    text = AutoCards("input", text);\n    return { text };\n};\nmodifier(text);`,
            onModelContext: `const modifier = (text) => {\n    [text, stop] = AutoCards("context", text, stop);\n    return { text, stop };\n};\nmodifier(text);`,
            onOutput: `const modifier = (text) => {\n    text = AutoCards("output", text);\n    return { text };\n};\nmodifier(text);`
        });
        console.log(`   ✔ Draft scripts & metadata updated for ${config.ecScenario}`);
        await moderateAndPublish(client, config.ecScenario, docMeta.title || "Entity Cards (NER)", "100% completion announcement and non-destructive state persistence snapshot");
    }

    // 4. Deploy Inner-Entity
    if (config.targets.has("ie") && config.ieScenario) {
        if (!fs.existsSync(config.iePath)) {
            console.error(`❌ Inner-Entity file not found at: ${config.iePath}`);
            process.exit(1);
        }
        const ieLib = fs.readFileSync(config.iePath, "utf8");
        const docMeta = parseAidDescription(path.resolve(__dirname, "../Inner-Entity/docs/AID_DESCRIPTION.md")) || {};
        console.log(`\n4. Deploying Inner-Entity Minds-Only (${config.ieScenario}): ${ieLib.length} bytes`);
        await client.updateScenario({
            shortId: config.ieScenario,
            title: docMeta.title || "Inner Entity (Minds)",
            description: docMeta.description || "Autonomous character minds, private goals, secrets, and thought simulation for AI Dungeon NPCs",
            advancedDescription: docMeta.advancedDescription || undefined,
            isScript: true,
            scriptsEnabled: true
        });
        await client.updateScenarioScripts(config.ieScenario, {
            sharedLibrary: ieLib,
            onInput: `InnerEntity("input");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`,
            onModelContext: `InnerEntity("context");\nconst modifier = (text) => {\n  return { text, stop };\n};\nmodifier(text);`,
            onOutput: `InnerEntity("output");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`
        });
        console.log(`   ✔ Draft scripts & metadata updated for ${config.ieScenario}`);
        await moderateAndPublish(client, config.ieScenario, docMeta.title || "Inner Entity (Minds)", "Minds-only cognition and 100% completion sync snapshot");
    }

    console.log("\n==================================================================");
    console.log("  🎉 DEPLOYMENT COMPLETE! All target scripts and metadata updated on AI Dungeon.");
    console.log("==================================================================");
}

main().catch(err => {
    console.error("\n❌ DEPLOYMENT FAILED:", err);
    process.exit(1);
});
