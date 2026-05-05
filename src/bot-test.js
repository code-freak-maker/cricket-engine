require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

console.log("=== BOT TEST STARTING ===");
console.log("Token exists:", !!process.env.DISCORD_TOKEN);
console.log("Client ID:", process.env.CLIENT_ID);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log("✅✅✅ BOT IS ONLINE! ✅✅✅");
  console.log(`Logged in as: ${client.user.tag}`);
  console.log(`Bot ID: ${client.user.id}`);
  console.log(`In ${client.guilds.cache.size} guilds`);
  
  client.guilds.cache.forEach(guild => {
    console.log(`- Guild: ${guild.name} (${guild.id})`);
  });
});

client.on("interactionCreate", async (interaction) => {
  console.log("Interaction received!");
  
  if (interaction.isChatInputCommand()) {
    console.log(`Command: ${interaction.commandName}`);
    
    if (interaction.commandName === "ping") {
      await interaction.reply("Pong! 🏓");
      console.log("Replied with Pong!");
    }
  }
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("Login function completed"))
  .catch(err => console.error("Login failed:", err));

// Keep the process alive
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

console.log("=== BOT TEST END OF SETUP ===");