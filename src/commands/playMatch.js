// play-match.js
const { SlashCommandBuilder } = require("discord.js");
const { getTeamByName, getAllPlayers, getRandomStadium, getStadiumByName, saveMatchResult } = require("../services/sheets");
const { validateTeam } = require("../utils/validator");
const { handleToss } = require("../match/tossHandler");
const { selectOpeners } = require("../match/selectionHandler");
const { simulateInnings } = require("../match/inningsHandler");
const { saveAndAnnounceResult } = require("../match/resultHandler");
const matchManager = require("../managers/matchManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play-match")
    .setDescription("Start an interactive cricket match")
    .addStringOption(opt => opt.setName("team_a").setDescription("Your team name").setRequired(true))
    .addStringOption(opt => opt.setName("team_b").setDescription("Opponent team name").setRequired(true))
    .addStringOption(opt => opt.setName("stadium").setDescription("Stadium name (optional)").setRequired(false)),

  async execute(interaction) {
    // Store channel reference at the very beginning
    const channel = interaction.channel;
    
    try {
      await interaction.deferReply();

      // Clean up any existing match first
      if (matchManager.getMatch(interaction.channelId)) {
        matchManager.deleteMatch(interaction.channelId);
      }

      const teamAName = interaction.options.getString("team_a");
      const teamBName = interaction.options.getString("team_b");
      const stadiumInput = interaction.options.getString("stadium");

      const teamA = await getTeamByName(teamAName);
      const teamB = await getTeamByName(teamBName);
      if (!teamA) return interaction.editReply(`❌ Team "${teamAName}" not found`);
      if (!teamB) return interaction.editReply(`❌ Team "${teamBName}" not found`);

      let stadium;
      if (stadiumInput) {
        stadium = await getStadiumByName(stadiumInput);
        if (!stadium) return interaction.editReply(`❌ Stadium "${stadiumInput}" not found`);
      } else {
        stadium = await getRandomStadium();
        if (!stadium) return interaction.editReply(`❌ No stadiums found`);
      }

      const allPlayers = await getAllPlayers();
      const playersMap = new Map(allPlayers.map(p => [p.name.toLowerCase().trim(), p]));

      const valA = await validateTeam(teamA, allPlayers);
      const valB = await validateTeam(teamB, allPlayers);
      if (!valA.ok) return interaction.editReply(`❌ ${teamA.teamName}: ${valA.reason}`);
      if (!valB.ok) return interaction.editReply(`❌ ${teamB.teamName}: ${valB.reason}`);

      const matchMessage = await interaction.editReply(
        `🏏 **${teamA.teamName} vs ${teamB.teamName}**
📍 Stadium: ${stadium.name} (${stadium.type})
🌍 Location: ${stadium.country}

Starting T20 match between ${teamA.teamName} and ${teamB.teamName} at ${stadium.name}!`
      );

      // TOSS
      const { tossWinnerTeam, tossDecision } = await handleToss(interaction, teamA, teamB, stadium, matchMessage);

      let battingTeam, bowlingTeam;
      if (tossDecision === "bat") {
        battingTeam = tossWinnerTeam;
        bowlingTeam = tossWinnerTeam.teamName === teamA.teamName ? teamB : teamA;
      } else {
        bowlingTeam = tossWinnerTeam;
        battingTeam = tossWinnerTeam.teamName === teamA.teamName ? teamB : teamA;
      }

      let content = matchMessage.content;
      content += `\n\n🏏 **${battingTeam.teamName} will bat first**\n🧤 **${bowlingTeam.teamName} will bowl**`;
      await matchMessage.edit({ content });

      // Initialize match state
      const matchState = {
        teamA, teamB,
        battingTeam, bowlingTeam,
        battingUser: battingTeam.owner,
        bowlingUser: bowlingTeam.owner,
        stadium,
        target: null,
        currentInnings: 1,
        maxOvers: 20,
        isActive: true,
        stopped: false,
        channelId: interaction.channelId,
        runs: 0,
        wickets: 0,
        partnershipRuns: 0,
        partnershipBalls: 0,
        lastWicket: null,
        currentOver: 0,
        batsmanStats: {},
        bowlerStats: new Map(),
        bowlerOvers: new Map(),
        lastBowler: null,
        dismissedBatsmen: new Set(),
        battingOrder: [],
        strikerIdx: 0,
        nonStrikerIdx: 1,
        nextBatsmanIdx: 2,
        currentInnings: 1,
        teamABattedFirst: (battingTeam.teamName === teamA.teamName)
      };

      // CREATE MATCH
      matchManager.createMatch(interaction.channelId, matchState);

      // SELECT OPENERS
      const openers = await selectOpeners(interaction, battingTeam, 1);
      
      const currentMatch = matchManager.getMatch(interaction.channelId);
      if (!currentMatch || !currentMatch.isActive || currentMatch.stopped || !openers) {
        // FIX: Use channel.send instead of followUp
        await channel.send("🛑 Match was stopped.");
        return;
      }

      // Update match state with batting order
      matchState.battingOrder = [openers[0], openers[1], ...battingTeam.players.filter(p => p !== openers[0] && p !== openers[1])];
      matchState.strikerIdx = 0;
      matchState.nonStrikerIdx = 1;
      matchState.nextBatsmanIdx = 2;

      matchState.battingOrder.forEach(name => {
        matchState.batsmanStats[name.toLowerCase().trim()] = { 
          name, 
          runs: 0, 
          balls: 0, 
          fours: 0, 
          sixes: 0 
        };
      });

      matchManager.updateMatch(interaction.channelId, matchState);

      // INNINGS 1
      // FIX: Use channel.send instead of followUp
      await channel.send(`🥇 **INNINGS 1: ${battingTeam.teamName} batting**`);

      const innings1 = await simulateInnings(interaction, matchState, playersMap, stadium, 1, null);

      const matchAfterInnings1 = matchManager.getMatch(interaction.channelId);
      if (!matchAfterInnings1 || !matchAfterInnings1.isActive || matchAfterInnings1.stopped) {
        matchManager.deleteMatch(interaction.channelId);
        await channel.send("🛑 Match was stopped.");
        return;
      }

      // Store innings 1 stats
      const innings1Stats = {
        runs: innings1.runs,
        wickets: innings1.wickets,
        overs: innings1.overs,
        batsmanStats: { ...innings1.batsmanStats },
        bowlerStats: new Map(innings1.bowlerStats)
      };

      // FIX: Use channel.send instead of followUp
      await channel.send(`📊 **${battingTeam.teamName}:** ${innings1.runs}/${innings1.wickets} (${innings1.overs} overs)`);

      // INNINGS 2
      const target = innings1.runs + 1;
      const newBattingTeam = bowlingTeam;
      const newBowlingTeam = battingTeam;

      // FIX: Use channel.send instead of followUp
      await channel.send(`🥈 **INNINGS 2: ${newBattingTeam.teamName} needs ${target} runs to win`);

      // Reset match state for innings 2
      matchState.battingTeam = newBattingTeam;
      matchState.bowlingTeam = newBowlingTeam;
      matchState.battingUser = newBattingTeam.owner;
      matchState.bowlingUser = newBowlingTeam.owner;
      matchState.target = target;
      matchState.currentInnings = 2;
      matchState.runs = 0;
      matchState.wickets = 0;
      matchState.partnershipRuns = 0;
      matchState.partnershipBalls = 0;
      matchState.lastWicket = null;
      matchState.currentOver = 0;
      matchState.batsmanStats = {};
      matchState.bowlerStats.clear();
      matchState.bowlerOvers.clear();
      matchState.lastBowler = null;
      matchState.dismissedBatsmen.clear();

      // Select openers for innings 2
      const newOpeners = await selectOpeners(interaction, newBattingTeam, 2);

      const matchBeforeInnings2 = matchManager.getMatch(interaction.channelId);
      if (!matchBeforeInnings2 || !matchBeforeInnings2.isActive || matchBeforeInnings2.stopped || !newOpeners) {
        matchManager.deleteMatch(interaction.channelId);
        await channel.send("🛑 Match was stopped.");
        return;
      }

      matchState.battingOrder = [newOpeners[0], newOpeners[1], ...newBattingTeam.players.filter(p => p !== newOpeners[0] && p !== newOpeners[1])];
      matchState.strikerIdx = 0;
      matchState.nonStrikerIdx = 1;
      matchState.nextBatsmanIdx = 2;

      matchState.battingOrder.forEach(name => {
        matchState.batsmanStats[name.toLowerCase().trim()] = { 
          name, 
          runs: 0, 
          balls: 0, 
          fours: 0, 
          sixes: 0 
        };
      });

      const innings2 = await simulateInnings(interaction, matchState, playersMap, stadium, 2, target);

      const matchAfterInnings2 = matchManager.getMatch(interaction.channelId);
      if (!matchAfterInnings2 || !matchAfterInnings2.isActive || matchAfterInnings2.stopped) {
        matchManager.deleteMatch(interaction.channelId);
        await channel.send("🛑 Match was stopped.");
        return;
      }

      // Store innings 2 stats
      const innings2Stats = {
        runs: innings2.runs,
        wickets: innings2.wickets,
        overs: innings2.overs,
        batsmanStats: { ...innings2.batsmanStats },
        bowlerStats: new Map(innings2.bowlerStats)
      };

      // RESULT
      const { winner, wonBy } = await saveAndAnnounceResult(
        interaction, 
        matchState, 
        innings1Stats, 
        innings2Stats, 
        target
      );

      // Save match result to database
      await saveMatchResult({
        teamA: teamA.teamName,
        teamB: teamB.teamName,
        scoreA: innings1.runs,
        scoreB: innings2.runs,
        wicketsA: innings1.wickets,
        wicketsB: innings2.wickets,
        oversA: innings1.overs,
        oversB: innings2.overs,
        winner,
        wonBy,
        ground: stadium.name,
        timestamp: Date.now()
      }).catch(err => console.error("Error saving:", err));

      matchManager.deleteMatch(interaction.channelId);
      
      // FIX: Use channel.send instead of followUp (THIS WAS THE MAIN ERROR AT LINE 252)
      await channel.send(`✅ Match completed! Use \`/play-match\` again to start a new match.`);
      
      // Optional: Try to update original reply (may fail if >15 min, but that's fine)
      try {
        await interaction.editReply({ 
          content: `🏏 Match underway! Final results posted above.` 
        });
      } catch (editError) {
        // Token expired - that's fine, we already sent results
        console.log('Interaction token expired before match completion');
      }

    } catch (error) {
      console.error("Match error:", error);
      
      if (error.code === 50027) {
        try {
          await channel.send('❌ Match stopped due to timeout. Please start a new match.');
        } catch (e) {
          console.error("Could not send error message:", e);
        }
      } else {
        try {
          // Try to edit reply if token still valid
          await interaction.editReply(`❌ Error: ${error.message}`).catch(async () => {
            // If that fails, send to channel
            await channel.send(`❌ Error: ${error.message}`);
          });
        } catch (e) {
          await channel.send(`❌ Error: ${error.message}`);
        }
      }
      
      matchManager.deleteMatch(interaction.channelId);
    }
  }
};