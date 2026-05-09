const fs = require("fs");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    InteractionType
} = require("discord.js");

const TOKEN = process.env.TOKEN;

// ================= DATABASE =================
const DB_FILE = "./database.json";

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({
            cooldowns: {},
            stats: {},
            userBoosts: {},
            globalBoost: null
        }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ================= CLIENT =================
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= FORMAT =================
function formatTime(ms) {
    if (ms <= 0) return "0s";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
}

// ================= READY =================
client.once("ready", async () => {
    console.log(`🎲 Bot działa (${client.user.tag})`);

    db = loadDB();
    saveDB(db); // 🔥 FIX: zapis po starcie

    const commands = [
        new SlashCommandBuilder()
            .setName("losowanie")
            .setDescription("Spróbuj swojego szczęścia!"),

        new SlashCommandBuilder()
            .setName("losowanieuczas")
            .setDescription("Usuń cooldown użytkownikowi")
            .addUserOption(o =>
                o.setName("user").setDescription("Użytkownik").setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("losowanieboost")
            .setDescription("Ustaw globalny boost"),

        new SlashCommandBuilder()
            .setName("losowanieboostend")
            .setDescription("Wyłącz globalny boost"),

        new SlashCommandBuilder()
            .setName("losowaniestats")
            .setDescription("Statystyki")
            .addUserOption(o =>
                o.setName("user").setDescription("Użytkownik").setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("botwiado")
            .setDescription("Wiadomość bota")
    ].map(c => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log("Slash OK ✔");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand() && interaction.type !== InteractionType.ModalSubmit) return;

    // ================= LOSOWANIE =================
    if (interaction.commandName === "losowanie") {

        const userId = interaction.user.id;
        const now = Date.now();

        db.stats[userId] ||= { played: 0, wins: 0, losses: 0, biggestWin: 0 };
        db.cooldowns ||= {};
        db.userBoosts ||= {};

        const nextTime = db.cooldowns[userId];

        if (nextTime && now < nextTime) {
            return interaction.reply({
                content: `⏰ Kolejny raz za:\n**${formatTime(nextTime - now)}**`,
                ephemeral: true
            });
        }

        db.cooldowns[userId] = now + 2 * 60 * 60 * 1000;
        saveDB(db); // 🔥 FIX: zapis cooldownu po ustawieniu

        const odds =
            db.globalBoost ||
            db.userBoosts[userId] || {
                m5: 1,
                m3: 2,
                m2: 6,
                m1: 15
            };

        const roll = Math.random() * 100;

        let reward = null;

        if (roll <= odds.m5) reward = "5 000 000 💰";
        else if (roll <= odds.m3) reward = "3 000 000 💰";
        else if (roll <= odds.m2) reward = "2 000 000 💰";
        else if (roll <= odds.m1) reward = "1 000 000 💰";

        const s = db.stats[userId];
        s.played++;

        if (reward) {
            s.wins++;

            const winValue = parseInt(reward.replace(/\D/g, ""));
            if (winValue > s.biggestWin) s.biggestWin = winValue;

            saveDB(db);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎉 WYGRANA!")
                        .setColor("#f1c40f")
                        .setDescription(
`💰 ${reward}

🎫 Napisz na ticket po nagrodę

⏰ Kolejny raz za: 2h`
                        )
                ]
            });
        }

        s.losses++;
        saveDB(db);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("💀 PRZEGRANA")
                    .setColor("#e74c3c")
                    .setDescription(
`❌ Nic nie wygrałeś

⏰ Kolejny raz za: 2h`
                    )
            ]
        });
    }

    // ================= BOOST =================
    if (interaction.commandName === "losowanieboost") {

        const current = db.globalBoost || {
            m5: 1,
            m3: 2,
            m2: 6,
            m1: 15
        };

        const modal = new ModalBuilder()
            .setCustomId("boost_global")
            .setTitle("🔥 GLOBAL BOOST");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("m5")
                    .setLabel(`5M 💰 — aktualnie: ${current.m5}%`)
                    .setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("m3")
                    .setLabel(`3M 💰 — aktualnie: ${current.m3}%`)
                    .setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("m2")
                    .setLabel(`2M 💰 — aktualnie: ${current.m2}%`)
                    .setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("m1")
                    .setLabel(`1M 💰 — aktualnie: ${current.m1}%`)
                    .setStyle(TextInputStyle.Short)
            )
        );

        return interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit &&
        interaction.customId === "boost_global") {

        db.globalBoost = {
            m5: +interaction.fields.getTextInputValue("m5"),
            m3: +interaction.fields.getTextInputValue("m3"),
            m2: +interaction.fields.getTextInputValue("m2"),
            m1: +interaction.fields.getTextInputValue("m1")
        };

        saveDB(db);

        return interaction.reply({
            content: "🔥 BOOST ustawiony!",
            ephemeral: true
        });
    }

    // ================= BOOST END =================
    if (interaction.commandName === "losowanieboostend") {

        db.globalBoost = null;
        saveDB(db);

        return interaction.reply({
            content: "🛑 BOOST WYŁĄCZONY",
            ephemeral: true
        });
    }

    // ================= BOT WIADOMOŚĆ =================
    if (interaction.commandName === "botwiado") {

        const modal = new ModalBuilder()
            .setCustomId("botwiado_modal")
            .setTitle("📩 Wiadomość");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("tekst")
                    .setLabel("Wiadomość")
                    .setStyle(TextInputStyle.Paragraph)
            )
        );

        return interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit &&
        interaction.customId === "botwiado_modal") {

        const tekst = interaction.fields.getTextInputValue("tekst");

        await interaction.reply({ content: "✅ Wysłano", ephemeral: true });

        interaction.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("") // 🔥 FIX: brak tytułu
                    .setColor("#2ecc71")
                    .setDescription(tekst)
            ]
        });
    }
});

client.login(TOKEN);
