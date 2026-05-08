const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const TOKEN = process.env.TOKEN;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= COOLDOWN =================
const cooldown = new Map();
const COOLDOWN_TIME = 2 * 60 * 60 * 1000; // 2h

// ===== FORMAT CZASU =====
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

    const commands = [
        new SlashCommandBuilder()
            .setName("losowanie")
            .setDescription("Spróbuj swojego szczęścia!")
    ].map(c => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log("Slash OK ✔");
});

// ================= LOSOWANIE =================
client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "losowanie") {

        const userId = interaction.user.id;
        const now = Date.now();

        // ===== COOLDOWN =====
        const nextTime = cooldown.get(userId);

        if (nextTime && now < nextTime) {
            const left = nextTime - now;

            return interaction.reply({
                content:
`⏰ Kolejny raz możesz losować za:
**${formatTime(left)}**`,
                ephemeral: true
            });
        }

        cooldown.set(userId, now + COOLDOWN_TIME);

        // ===== LOSOWANIE =====
        const roll = Math.random() * 100;

        let reward = null;
        let chance = 0;

        if (roll <= 1) {
            reward = "5 000 000 💰";
            chance = 1;
        }
        else if (roll <= 3) {
            reward = "3 000 000 💰";
            chance = 2;
        }
        else if (roll <= 7) {
            reward = "2 000 000 💰";
            chance = 4;
        }
        else if (roll <= 27) {
            reward = "1 000 000 💰";
            chance = 20;
        }

        // ===== WYGRANA =====
        if (reward) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎉 WYGRANA!")
                        .setColor("#f1c40f")
                        .setDescription(
`💰 **Wygrałeś: ${reward}**

🎫 Po nagrodę napisz na ticket
⏰ Kolejne losowanie za: **2h**`
                        )
                ]
            });
        }

        // ===== PRZEGRANA =====
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("💀 PRZEGRANA")
                    .setColor("#e74c3c")
                    .setDescription(
`❌ Nic nie wygrałeś

⏰ Kolejne losowanie za: **2h**`
                    )
            ]
        });
    }
});

client.login(TOKEN);
