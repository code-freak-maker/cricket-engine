// commands/stadium.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require("discord.js");
const { getAllStadiums, getStadiumByName } = require("../services/sheets");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stadium")
    .setDescription("View stadium information and pitch conditions")
    .addStringOption(option =>
      option.setName("name")
        .setDescription("Stadium name (leave empty to see all stadiums)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const stadiumName = interaction.options.getString("name");

    // If specific stadium requested
    if (stadiumName) {
      const stadium = await getStadiumByName(stadiumName);
      if (!stadium) {
        return interaction.editReply(`❌ Stadium "${stadiumName}" not found.`);
      }

      const embed = createStadiumEmbed(stadium);
      return interaction.editReply({ embeds: [embed] });
    }

    // Show all stadiums with dropdown (max 25)
    const allStadiums = await getAllStadiums();

    if (!allStadiums || allStadiums.length === 0) {
      return interaction.editReply("❌ No stadiums found in database.");
    }

    // Sort by name
    const sortedStadiums = [...allStadiums].sort((a, b) => a.name.localeCompare(b.name));

    // Discord only allows 25 options max
    const displayStadiums = sortedStadiums.slice(0, 25);
    const hasMore = sortedStadiums.length > 25;

    // Create dropdown menu (max 25 options)
    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_stadium")
        .setPlaceholder("Select a stadium to view details")
        .addOptions(
          displayStadiums.map(stadium => ({
            label: stadium.name.length > 100 ? stadium.name.substring(0, 97) + "..." : stadium.name,
            value: stadium.name,
            description: stadium.type.substring(0, 50),
          }))
        )
    );

    // Create summary embed with all stadiums
    let stadiumList = sortedStadiums.map((s, i) => `${i + 1}. **${s.name}** (${s.country})`).join("\n");

    // Truncate if too long
    if (stadiumList.length > 1000) {
      stadiumList = sortedStadiums.slice(0, 30).map((s, i) => `${i + 1}. **${s.name}** (${s.country})`).join("\n");
      if (sortedStadiums.length > 30) {
        stadiumList += `\n... and ${sortedStadiums.length - 30} more stadiums`;
      }
    }

    const summaryEmbed = new EmbedBuilder()
      .setTitle("🏟️ Cricket Stadiums")
      .setDescription(`Total **${sortedStadiums.length}** stadiums available. Select a stadium from the dropdown below to view detailed pitch conditions.`)
      .setColor(0x00AE86)
      .addFields({
        name: "📋 Quick List",
        value: stadiumList,
        inline: false
      })
      .setFooter({ text: "Use /stadium <name> to directly view a stadium" });

    await interaction.editReply({
      embeds: [summaryEmbed],
      components: [selectMenu]
    });

    // Handle stadium selection - REMOVED user filter
    const filter = (i) => i.customId === "select_stadium"; // Only filter by customId
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 60000,
      componentType: ComponentType.StringSelect
    });

    collector.on("collect", async (menuInteraction) => {
      await menuInteraction.deferUpdate();
      const selectedName = menuInteraction.values[0];
      const selectedStadium = sortedStadiums.find(s => s.name === selectedName);

      if (selectedStadium) {
        const embed = createStadiumEmbed(selectedStadium);
        // Changed from flags: 64 to regular followUp (visible to everyone)
        await menuInteraction.followUp({ embeds: [embed] });
      }
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (e) {
        // Ignore
      }
    });
  }
};

// Helper function to create stadium embed
function createStadiumEmbed(stadium) {
  // Determine pitch condition based on ratings
  let pitchCondition = "";
  if (stadium.pace >= 8 && stadium.bounce >= 7) pitchCondition = "🔥 Fast Bowler's Paradise";
  else if (stadium.turn >= 8) pitchCondition = "🌀 Spinner's Delight";
  else if (stadium.batting >= 9) pitchCondition = "🏏 Batting Heaven";
  else if (stadium.pace <= 4 && stadium.turn <= 4) pitchCondition = "⚖️ Balanced Pitch";
  else pitchCondition = "📊 Mixed Conditions";

  // Determine boundary size description
  let boundaryDesc = "";
  if (stadium.boundarySize >= 9) boundaryDesc = "🔴 Very Large (Hard to clear)";
  else if (stadium.boundarySize >= 7) boundaryDesc = "🟠 Large";
  else if (stadium.boundarySize >= 4) boundaryDesc = "🟡 Medium";
  else if (stadium.boundarySize >= 2) boundaryDesc = "🟢 Small";
  else boundaryDesc = "🟢 Very Small (Easy sixes)";

  // Create star rating helper
  const getStars = (value) => {
    const fullStars = Math.floor(value / 2);
    const emptyStars = 5 - fullStars;
    return "⭐".repeat(fullStars) + "☆".repeat(emptyStars);
  };

  const embed = new EmbedBuilder()
    .setTitle(`🏟️ ${stadium.name}`)
    .setDescription(`📍 ${stadium.country}\n📋 **Type:** ${stadium.type}`)
    .setColor(0x00AE86)
    .addFields(
      {
        name: "🎯 Pitch Conditions",
        value: `💨 **Pace:** ${getStars(stadium.pace)} (${stadium.pace}/10)
📈 **Bounce:** ${getStars(stadium.bounce)} (${stadium.bounce}/10)
🌀 **Swing:** ${getStars(stadium.swing)} (${stadium.swing}/10)
🔄 **Turn:** ${getStars(stadium.turn)} (${stadium.turn}/10)
🏏 **Batting:** ${getStars(stadium.batting)} (${stadium.batting}/10)`,
        inline: false
      },
      {
        name: "📏 Boundary Size",
        value: `${boundaryDesc}`,
        inline: true
      },
      {
        name: "⚡ Verdict",
        value: pitchCondition,
        inline: true
      }
    )
    .setFooter({ text: "Higher rating = More assistance to that skill" });

  return embed;
}