// src/bot.js
require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================
// GLOBAL ERROR LOGGING
// =====================
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:");
  console.error(err);
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 UNHANDLED REJECTION:");
  console.error(reason);
});

// =====================
// ENV DEBUG
// =====================
console.log("========== ENV CHECK ==========");
console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN ? "✔ SET" : "❌ MISSING");
console.log("CLIENT_ID:", process.env.CLIENT_ID ? "✔ SET" : "❌ MISSING");
console.log("GUILD_ID:", process.env.NEW_GUILD_ID ? "✔ SET" : "❌ MISSING");
console.log("GOOGLE_CREDENTIALS:", process.env.GOOGLE_CREDENTIALS ? "✔ SET" : "❌ MISSING");
console.log("================================");

// =====================
// EXPRESS SERVER (FOR RENDER)
// =====================
const app = express();

app.get("/", (req, res) => {
  res.send("🏏 Cricket Bot is running!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// =====================
// DISCORD CLIENT
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// =====================
// LOAD COMMANDS
// =====================
const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  console.error("❌ Commands folder not found:", commandsPath);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith(".js"));

const commands = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

console.log(`📦 Loaded ${commands.length} commands`);

// =====================
// REGISTER COMMANDS
// =====================
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🔄 Registering commands...");
    console.log("CLIENT_ID:", process.env.CLIENT_ID);
    console.log("GUILD_ID:", process.env.NEW_GUILD_ID);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.NEW_GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Commands registered!");
  } catch (error) {
    console.error("❌ Command registration failed:");
    console.error(error);
  }
})();

// =====================
// READY EVENT
// =====================
client.once("clientReady", (c) => {
  console.log("🤖 BOT READY");
  console.log("Bot Tag:", c.user.tag);
  console.log("Bot ID:", c.user.id);

  console.log("📡 Connected Guilds:");
  client.guilds.cache.forEach(g => {
    console.log(`➡️ ${g.name} (${g.id})`);
  });

  console.log("⚠️ If your server is NOT listed above → bot is not in that server");
});

// =====================
// INTERACTION HANDLER
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`📥 Command received: ${interaction.commandName}`);
  console.log(`👤 User: ${interaction.user.tag}`);
  console.log(`🏠 Guild ID: ${interaction.guildId}`);

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log("❌ Command not found:", interaction.commandName);
    return;
  }

  try {
    console.time(`⏱ ${interaction.commandName}`);

    await command.execute(interaction);

    console.timeEnd(`⏱ ${interaction.commandName}`);
    console.log(`✅ Command executed: ${interaction.commandName}`);
  } catch (err) {
    console.error(`❌ Command failed: ${interaction.commandName}`);
    console.error(err);

    try {
      if (interaction.deferred) {
        await interaction.editReply("❌ Error executing command");
      } else if (interaction.replied) {
        await interaction.followUp("❌ Error executing command");
      } else {
        await interaction.reply("❌ Error executing command");
      }
    } catch (e) {
      console.error("❌ Failed to send error response:", e);
    }
  }
});

// =====================
// LOGIN
// =====================
console.log("🔐 Logging in bot...");

client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log("✅ Login successful");
  })
  .catch((err) => {
    console.error("❌ Login failed:");
    console.error(err);
  });