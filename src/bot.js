// src/bot.js
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🔄 Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.NEW_GUILD_ID),
      { body: commands }
    );
    console.log("✅ Commands registered!");
  } catch (error) {
    console.error(error);
  }
})();

// ✅ CORRECT PLACEMENT: Define the interaction handler AFTER client is created
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing ${interaction.commandName}:`, err);

    // Special handling for token expiration (50027 error)
    if (err.code === 50027) {
      try {
        await interaction.channel.send({
          content: "⚠️ Command took too long to complete. Results have been posted in the channel if successful."
        });
      } catch (e) {
        console.error("Could not send timeout message:", e);
      }
      return;
    }

    const errorMessage = "❌ Error executing command. Please try again.";

    if (interaction.deferred) {
      await interaction.editReply(errorMessage).catch(console.error);
    } else if (interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(console.error);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true }).catch(console.error);
    }
  }
});

client.once("ready", (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
});


app.get("/", (req, res) => {
  res.send("Cricket bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);