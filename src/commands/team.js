// commands/team.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getTeamByName, getAllPlayers, getPlayerBasicInfo } = require("../services/sheets");
const { validateTeam } = require("../utils/validator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("team")
    .setDescription("Get a cricket team by name")
    .addStringOption(option =>
      option.setName("name")
        .setDescription("Enter team name")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const teamName = interaction.options.getString("name");
    const team = await getTeamByName(teamName);
    
    if (!team) return interaction.editReply(`❌ Team "${teamName}" not found!`);

    // Fetch all players from database for validation
    const allPlayers = await getAllPlayers();
    const validation = await validateTeam(team, allPlayers);

    // Create embed for better display
    const embed = new EmbedBuilder()
      .setTitle(`🏏 ${team.teamName}`)
      .setColor(validation.ok ? 0x00AE86 : 0xFF0000)
      .addFields(
        { name: "👤 Owner", value: team.owner || "Unknown", inline: true },
        { name: "📋 Players", value: `${team.players.length}/11`, inline: true }
      );

    // Build players list with matching status
    let playersList = "";
    for (let i = 0; i < team.players.length; i++) {
      const playerName = team.players[i];
      const match = validation.matchResults?.matched.find(m => m.teamInput === playerName.trim());
      
      if (match) {
        const statusIcon = match.matchType === "exact" ? "✅" : "⚠️";
        playersList += `${i+1}. ${statusIcon} **${match.dbName}** (${match.role})\n`;
      } else if (validation.matchResults?.notFound.includes(playerName.trim())) {
        playersList += `${i+1}. ❌ **${playerName}** (NOT FOUND IN DATABASE)\n`;
      } else {
        playersList += `${i+1}. ${playerName}\n`;
      }
    }
    
    embed.addFields({ name: "📝 Roster", value: playersList || "No players", inline: false });

    // Add validation status
    if (validation.ok) {
      embed.addFields({ name: "✅ Status", value: "Team is VALID and ready to play!", inline: false });
      
      // Show team composition summary
      const wk = validation.matchResults.matched.filter(m => getPlayerCategory(m.role) === "wk").length;
      const bowlers = validation.matchResults.matched.filter(m => 
        getPlayerCategory(m.role) === "bowler" || getPlayerCategory(m.role) === "allrounder"
      ).length;
      const batsmen = validation.matchResults.matched.length - wk - bowlers;
      
      embed.addFields({ 
        name: "📊 Composition", 
        value: `🧤 Wicketkeepers: ${wk}\n🏏 Batsmen: ${batsmen}\n🎯 Bowlers/Allrounders: ${bowlers}`,
        inline: false 
      });
    } else {
      embed.addFields({ name: "❌ Validation Failed", value: validation.reason, inline: false });
    }

    // Add warning for partial matches
    if (validation.matchResults?.partialMatches?.length > 0) {
      const warnings = validation.matchResults.partialMatches.map(m => 
        `"${m.teamInput}" → "${m.dbName}"`
      ).join("\n");
      embed.addFields({ 
        name: "⚠️ Partial Matches", 
        value: `The following names were matched partially. Please update the team sheet for exact matches:\n${warnings}`,
        inline: false 
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

// Helper function (re-export from validator)
function getPlayerCategory(role) {
  const r = role.toLowerCase();
  if (r.includes("wicketkeeper") || r === "wicket keeper") return "wk";
  if (r.includes("fast bowler")) return "bowler";
  if (r.includes("spin bowler")) return "bowler";
  if (r.includes("fast allrounder")) return "allrounder";
  if (r.includes("spin allrounder")) return "allrounder";
  if (r.includes("batsman")) return "batsman";
  return "other";
}