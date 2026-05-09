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

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= COOLDOWN =================
const cooldown = new Map();
const COOLDOWN_TIME = 2 * 60 * 60 * 1000; // 2h

// ================= BOOST PER USER =================
const userBoosts = new Map();

// 🔥 GLOBAL BOOST
let globalBoost = null;

// ================= STATS =================
const stats = new Map();

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
            .setDescription("Spróbuj swojego szczęścia!"),

        new SlashCommandBuilder()
            .setName("losowanieuczas")
            .setDescription("Usuń cooldown użytkownikowi")
            .addUserOption(o =>
                o.setName("user").setDescription("Użytkownik").setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("losowanieboost")
            .setDescription("Ustaw boost szans"),

        new SlashCommandBuilder()
            .setName("losowanieboostend")
            .setDescription("Wyłącz globalny boost"),

        new SlashCommandBuilder()
            .setName("losowaniestats")
            .setDescription("Statystyki losowania")
            .addUserOption(o =>
                o.setName("user")
                    .setDescription("Użytkownik")
                    .setRequired(true)
            ),

        // 🔥 NOWA KOMENDA
        new SlashCommandBuilder()
            .setName("wymianawiadmo")
            .setDescription("Wyślij wiadomość o wymianie")

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

        if (!stats.has(userId)) {
            stats.set(userId, { played: 0, wins: 0, losses: 0, biggestWin: 0 });
        }

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

        const odds =
            globalBoost ||
            userBoosts.get(userId) || {
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

        const s = stats.get(userId);
        s.played++;

        if (reward) {
            s.wins++;

            const winValue = parseInt(reward.replace(/\D/g, ""));
            if (winValue > s.biggestWin) s.biggestWin = winValue;

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

        s.losses++;

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

    // ================= STATS =================
    if (interaction.commandName === "losowaniestats") {

        const user = interaction.options.getUser("user");

        const s = stats.get(user.id) || {
            played: 0,
            wins: 0,
            losses: 0,
            biggestWin: 0
        };

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`📊 Statystyki ${user.username}`)
                    .setColor("#3498db")
                    .setDescription(
`🎲 Łączne losowania: ${s.played}
🏆 Wygrane: ${s.wins}
💀 Przegrane: ${s.losses}
💰 Biggest win: ${s.biggestWin} 💰`
                    )
            ],
            ephemeral: true
        });
    }

    // ================= COOLDOWN REMOVE =================
    if (interaction.commandName === "losowanieuczas") {

        const user = interaction.options.getUser("user");

        cooldown.delete(user.id);

        return interaction.reply({
            content: `✅ Usunięto cooldown dla <@${user.id}>`,
            ephemeral: true
        });
    }

    // ================= BOOST =================
    if (interaction.commandName === "losowanieboost") {

        const current = globalBoost || {
            m5: 1,
            m3: 2,
            m2: 6,
            m1: 15
        };

        const modal = new ModalBuilder()
            .setCustomId(`boost_global`)
            .setTitle("🌍 BOOST");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("m5").setLabel(`5M (${current.m5}%)`).setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("m3").setLabel(`3M (${current.m3}%)`).setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("m2").setLabel(`2M (${current.m2}%)`).setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("m1").setLabel(`1M (${current.m1}%)`).setStyle(TextInputStyle.Short)
            )
        );

        return interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit &&
        interaction.customId === "boost_global") {

        globalBoost = {
            m5: parseFloat(interaction.fields.getTextInputValue("m5")),
            m3: parseFloat(interaction.fields.getTextInputValue("m3")),
            m2: parseFloat(interaction.fields.getTextInputValue("m2")),
            m1: parseFloat(interaction.fields.getTextInputValue("m1"))
        };

        return interaction.reply({
            content: "🔥 GLOBAL BOOST ustawiony!",
            ephemeral: true
        });
    }

    // ================= BOOST END =================
    if (interaction.commandName === "losowanieboostend") {

        globalBoost = null;

        return interaction.reply({
            content: "🛑 Boost wyłączony",
            ephemeral: true
        });
    }

    // ================= WYMIANA WIADOMOŚĆ =================
    if (interaction.commandName === "wymianawiadmo") {

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("💱 Wymieniarka walut")
                    .setColor("#2ecc71")
                    .setDescription(
`————————————————————
🎈 **LifeSteal ➡️ OneBlock**
1k = 900k

🎈 **BoxPvp ➡️ OneBlock**
100k = 350k
————————————————————

⚠️ Jeżeli jesteś zainteresowany — rozpocznij wymianę z nami!`
                    )
            ]
        });
    }
});

client.login(TOKEN);
