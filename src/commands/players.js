// commands/players.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { getAllPlayers } = require("../services/sheets");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("players")
    .setDescription("Show all available players in database"),

  async execute(interaction) {
    await interaction.deferReply();
    
    const players = await getAllPlayers();
    
    if (!players || players.length === 0) {
      return interaction.editReply("❌ No players found in database.");
    }

    // Sort players alphabetically
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
    
    // Group players by role
    const byRole = {
      "Batsman": [],
      "Wicket Keeper": [],
      "Fast Bowler": [],
      "Spin Bowler": [],
      "Fast Allrounder": [],
      "Spin Allrounder": [],
      "All Rounder": [],
      "Other": []
    };
    
    for (const player of sortedPlayers) {
      const role = player.role;
      if (role.includes("Batsman")) byRole["Batsman"].push(player);
      else if (role.includes("Wicket Keeper") || role.includes("Keeper")) byRole["Wicket Keeper"].push(player);
      else if (role.includes("Fast Bowler")) byRole["Fast Bowler"].push(player);
      else if (role.includes("Spin Bowler")) byRole["Spin Bowler"].push(player);
      else if (role.includes("Fast Allrounder")) byRole["Fast Allrounder"].push(player);
      else if (role.includes("Spin Allrounder")) byRole["Spin Allrounder"].push(player);
      else if (role.includes("All Rounder")) byRole["All Rounder"].push(player);
      else byRole["Other"].push(player);
    }
    
    // Store current state (now global for the message)
    let currentRole = null;
    let currentPage = 0;
    let currentPlayersList = [];
    let totalPages = 0;
    
    // Function to generate the role selection menu
    const getRoleSelectMenu = () => {
      const roleOptions = [];
      for (const [role, playersList] of Object.entries(byRole)) {
        if (playersList.length > 0) {
          roleOptions.push({
            label: `${role} (${playersList.length})`,
            value: role,
            description: `View ${playersList.length} players`
          });
        }
      }
      
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_role")
          .setPlaceholder("Select a role to view players")
          .addOptions(roleOptions.slice(0, 25))
      );
    };
    
    // Function to generate the player list embed
    const generatePlayerEmbed = (role, page) => {
      const playersList = byRole[role];
      if (!playersList || playersList.length === 0) return null;
      
      const itemsPerPage = 25;
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pagePlayers = playersList.slice(start, end);
      
      const embed = new EmbedBuilder()
        .setTitle(`🏏 ${role} (${playersList.length} players)`)
        .setColor(0x00AE86)
        .setDescription(pagePlayers.map((p, i) => `${start + i + 1}. **${p.name}**`).join("\n"))
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(playersList.length / itemsPerPage)}` });
      
      return embed;
    };
    
    // Function to get navigation buttons
    const getNavButtons = (role, page) => {
      const playersList = byRole[role];
      const itemsPerPage = 25;
      const totalPages = Math.ceil(playersList.length / itemsPerPage);
      
      const row = new ActionRowBuilder();
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
      return row;
    };
    
    // Send initial message with role selector only
    await interaction.editReply({
      content: `📋 **Player Database** - Total: **${players.length} players**\nSelect a role from the dropdown to view players:`,
      components: [getRoleSelectMenu()]
      // Removed ephemeral: true
    });
    
    // Create collector for role selection - REMOVED user filter
    const roleCollector = interaction.channel.createMessageComponentCollector({
      filter: (i) => i.customId === "select_role", // Only filter by customId, not user
      time: 120000
    });
    
    roleCollector.on("collect", async (menuInteraction) => {
      // Acknowledge the interaction immediately
      await menuInteraction.deferUpdate();
      
      const selectedRole = menuInteraction.values[0];
      const playersList = byRole[selectedRole];
      
      if (!playersList || playersList.length === 0) {
        await menuInteraction.followUp({
          content: `No players found for role: ${selectedRole}`,
          ephemeral: true
        });
        return;
      }
      
      // Update current state
      currentRole = selectedRole;
      currentPage = 0;
      currentPlayersList = playersList;
      totalPages = Math.ceil(playersList.length / 25);
      
      // Update the original message with player list and navigation
      await menuInteraction.editReply({
        content: `📋 **Player Database** - Total: **${players.length} players**\nShowing: **${selectedRole}**`,
        embeds: [generatePlayerEmbed(selectedRole, 0)],
        components: [getRoleSelectMenu(), getNavButtons(selectedRole, 0)]
      });
    });
    
    // Create collector for pagination buttons - REMOVED user filter
    const buttonCollector = interaction.channel.createMessageComponentCollector({
      filter: (i) => i.customId === "prev_page" || i.customId === "next_page", // Only filter by customId
      time: 120000
    });
    
    buttonCollector.on("collect", async (buttonInteraction) => {
      // Acknowledge the interaction immediately
      await buttonInteraction.deferUpdate();
      
      if (!currentRole) return;
      
      const playersList = byRole[currentRole];
      const itemsPerPage = 25;
      const totalPages = Math.ceil(playersList.length / itemsPerPage);
      
      if (buttonInteraction.customId === "next_page" && currentPage < totalPages - 1) {
        currentPage++;
      } else if (buttonInteraction.customId === "prev_page" && currentPage > 0) {
        currentPage--;
      }
      
      // Update the message
      await buttonInteraction.editReply({
        embeds: [generatePlayerEmbed(currentRole, currentPage)],
        components: [getRoleSelectMenu(), getNavButtons(currentRole, currentPage)]
      });
    });
    
    // Clean up after timeout
    setTimeout(async () => {
      try {
        const message = await interaction.fetchReply();
        if (message && message.editable) {
          await interaction.editReply({ components: [] });
        }
      } catch (e) {
        // Ignore
      }
    }, 120000);
  }
};