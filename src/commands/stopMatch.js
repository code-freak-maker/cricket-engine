// commands/stopMatch.js
const { SlashCommandBuilder } = require("discord.js");
const matchManager = require("../managers/matchManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop-match")
    .setDescription("Stop the ongoing match in this channel")
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Reason for stopping match")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.channelId;
    const match = matchManager.getMatch(channelId);

    if (!match) {
      return interaction.editReply("❌ No active match found in this channel.");
    }

    const reason = interaction.options.getString("reason") || "No reason provided";

    // HARD STOP - use the manager's stopMatch method
    const stopped = matchManager.stopMatch(channelId, {
      reason: reason,
      stoppedBy: interaction.user.username
    });

    if (stopped) {
      return interaction.editReply(
        `🛑 Match stopped successfully.\nReason: **${reason}**\nStopped by: ${interaction.user.username}\n\n⚠️ The match has been terminated. No further overs will be played.`
      );
    } else {
      return interaction.editReply("❌ Failed to stop match.");
    }
  }
};