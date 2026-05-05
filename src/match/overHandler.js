// match/overHandler.js - FULLY FIXED with proper wicket handling
const { simulateBall } = require("../engine/matchEngine");
const { selectBowlerForOver, selectNextBatsman, getAvailableBowlers } = require("./selectionHandler");
const matchManager = require("../managers/matchManager");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const commentary = {
  0: ["Dot ball! Good delivery.", "No run there.", "Defended solidly.", "Beaten! No run.", "Excellent bowling!", "Played straight to fielder.", "Dead bat defense.", "Mistimed to mid-off.", "Solid block.", "Beaten all ends up!", "Edged but falls short!", "Play and miss!", "Through to the keeper.", "Well fielded!", "Pressure building!"],
  1: ["Quick single taken.", "Tap and run, they get one.", "Easy single to rotate strike.", "Just a single, good cricket.", "They scamper through for one!", "Soft hands, quick run.", "Pushed into the gap.", "Dropped and they run!", "Quick thinking, great running.", "Single to keep the strike.", "Nudged around the corner.", "Well-run single."],
  2: ["Good running, two runs!", "Well placed, couple of runs.", "They'll take two, excellent running.", "Hard running gives them two.", "Picked the gap, back for two.", "Sprints make it two!", "Fielding error allows two.", "Well-judged two runs.", "Good cricket, they run hard.", "Placed perfectly, two coming."],
  3: ["Excellent running, three runs!", "Hard running gives them three!", "They push hard for three!", "Great commitment for three!", "Aggressive running, three taken!", "All the way for three!", "The outfield is slow, they take three!", "Brilliant judgment, three runs!"],
  4: ["FOUR! Cracked to the boundary!", "Beautiful timing! Races away for four!", "Smashed through covers for four!", "That's a classy shot for four!", "Pierces the gap! Four runs!", "Lovely drive, four to the fence!", "Cut away powerfully for four!", "Pulled fine for four!", "FOUR! No need to run for that!", "Glorious shot! Finds the rope!"],
  6: ["SIX! Out of the park!", "Huge hit! Maximum!", "Clean strike! Gone all the way!", "What a strike! Into the stands!", "SIX! That's massive!", "High and deep! Six runs!", "Over the ropes! Maximum!", "Crowd goes wild! Six!", "That's out of the stadium!", "SIX! What a shot!", "Flat and hard for six!", "Dismissed over long-on for six!"],
  wicket: ["OUT! Bowled him!", "CAUGHT! Big wicket!", "TIMBER! Middle stump flattened!", "LBW! The umpire agrees!", "Gone! Huge breakthrough!", "Caught behind! Huge appeal and given!", "Clean bowled! Off stump cartwheeling!", "What a catch! That's a screamer!", "Run out! Direct hit!", "Stumped! The keeper is quick!", "LBW! Plumb in front!", "Top edge and taken! Big wicket!"],
  noball: ["No-ball! Free hit coming.", "Oversteps! No-ball called.", "The umpire signals a no-ball!", "Free hit coming next!", "Foot fault! No-ball given!", "That's a no-ball! Free hit next delivery!", "Bowler oversteps, called no-ball!"],
  wide: ["Wide! Too far outside.", "Down leg, called wide.", "Wayward delivery, called wide.", "Wide down the leg side!", "Too high, called wide!", "That's a wide! Ball passing down leg.", "Outside off, not playing a shot, wide called!"]
};

function getCommentary(runs, isWicket = false, extraType = null) {
  if (extraType === "noball") return commentary.noball[Math.floor(Math.random() * commentary.noball.length)];
  if (extraType === "wide") return commentary.wide[Math.floor(Math.random() * commentary.wide.length)];
  if (isWicket) return commentary.wicket[Math.floor(Math.random() * commentary.wicket.length)];
  const key = runs === 0 ? 0 : runs >= 4 ? (runs === 4 ? 4 : 6) : runs;
  return commentary[key][Math.floor(Math.random() * commentary[key].length)];
}

function getBallSymbol(runs, isWicket, extraType) {
  if (extraType === "noball") return "NB";
  if (extraType === "wide") return "WD";
  if (isWicket) return "W";
  if (runs === 0) return "•";
  return runs.toString();
}

async function playOver(interaction, matchState, playersMap, stadium, overNumber, inningNumber, target, channelId) {
  const match = matchManager.getMatch(channelId);
  if (!match || !match.isActive || match.stopped) {
    return { endReason: "match_stopped" };
  }

  // Initialize tracking objects
  if (!matchState.bowlerOvers) matchState.bowlerOvers = new Map();
  if (!matchState.bowlerStats) matchState.bowlerStats = new Map();
  if (!matchState.dismissedBatsmen) matchState.dismissedBatsmen = new Set();

  // Initialize over state for momentum tracking
  let overState = {
    runsInOver: 0,
    wicketsInOver: 0,
    boundariesInOver: 0,
    consecutiveDots: 0,
    consecutiveBoundaries: 0,
    lastBallWasBoundary: false
  };

  // Select bowler for this over
  let availableBowlers = getAvailableBowlers(matchState.bowlingTeam, playersMap);

  availableBowlers = availableBowlers.filter(name => {
    const oversBowled = matchState.bowlerOvers.get(name) || 0;
    return oversBowled < 4 && name !== matchState.lastBowler;
  });

  if (availableBowlers.length === 0) {
    availableBowlers = getAvailableBowlers(matchState.bowlingTeam, playersMap).filter(name => {
      const oversBowled = matchState.bowlerOvers.get(name) || 0;
      return oversBowled < 4;
    });
  }

  const bowlerName = await selectBowlerForOver(
    interaction, availableBowlers, overNumber, inningNumber, matchState, playersMap
  );

  if (!bowlerName) return { endReason: "match_stopped" };

  const bowler = playersMap.get(bowlerName.toLowerCase().trim());

  if (!matchState.bowlerStats.has(bowlerName)) {
    matchState.bowlerStats.set(bowlerName, { name: bowlerName, runs: 0, wickets: 0, overs: 0 });
  }
  const bowlerStats = matchState.bowlerStats.get(bowlerName);
  bowlerStats.overs++;
  matchState.bowlerOvers.set(bowlerName, bowlerStats.overs);
  matchState.lastBowler = bowlerName;
  const displayOverNumber = overNumber + 1;
  let commentaryText = `\n🎯 **Over ${displayOverNumber}** - ${bowlerName} comes into bowl\n`;
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  const overMessage = await interaction.channel.send(commentaryText);

  let ballEvents = [];
  let overRuns = 0;
  let overWickets = 0;
  let isFreeHit = false;
  let ballsBowled = 0;

  while (ballsBowled < 6) {
    const currentMatch = matchManager.getMatch(channelId);
    if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) {
      return { endReason: "match_stopped" };
    }
    if (matchState.wickets >= 10) break;
    if (target && matchState.runs >= target) break;

    // CRITICAL FIX: Get current striker (might have changed after wicket)
    const strikerName = matchState.battingOrder[matchState.strikerIdx];
    const striker = playersMap.get(strikerName.toLowerCase().trim());

    if (!striker) {
      console.error(`Striker not found: ${strikerName}`);
      break;
    }

    // Calculate momentum factors for this ball
    const momentumFactors = getMomentumFactors(overState, ballsBowled + 1);

    // Check for extras (unless it's a free hit)
    let extra = null;
    if (!isFreeHit) {
      extra = getExtra(bowler, momentumFactors.bowler);
    }

    const ballNumber = ballsBowled + 1;
    const ballDisplay = `${overNumber}.${ballNumber}`;

    // Handle extras
    if (extra) {
      matchState.runs += extra.runs;
      overRuns += extra.runs;
      overState.runsInOver += extra.runs;

      // Update bowler stats
      bowlerStats.runs += extra.runs;

      const comment = getCommentary(0, false, extra.type);

      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | **${extra.type.toUpperCase()}** | ${comment}\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;

      ballEvents.push(getBallSymbol(0, false, extra.type));

      await overMessage.edit(commentaryText);
      await sleep(1000);

      if (extra.type === "noball") {
        isFreeHit = true;
      }
      // For both no-ball and wide, this ball doesn't count as a legal delivery
      continue; // Back to while loop, same ball number increment
    }

    // Normal ball delivery or free hit
    const outcome = simulateBall(striker, bowler, stadium, overNumber, isFreeHit, momentumFactors);

    // Reset free hit after this ball
    const currentFreeHit = isFreeHit;
    isFreeHit = false;

    if (outcome.type === "wicket") {
      // CRITICAL FIX: Record which batsman got out BEFORE changing anything
      const outBatsman = strikerName;
      const outBatsmanKey = outBatsman.toLowerCase().trim();

      // WICKET!
      matchState.wickets++;
      overWickets++;
      overState.wicketsInOver++;
      overState.consecutiveDots = 0;
      overState.consecutiveBoundaries = 0;
      overState.lastBallWasBoundary = false;

      // Update bowler stats
      bowlerStats.wickets++;

      // Mark batsman as dismissed
      matchState.dismissedBatsmen.add(outBatsman);

      const wicketRuns = matchState.batsmanStats[outBatsmanKey]?.runs || 0;
      const wicketBalls = matchState.batsmanStats[outBatsmanKey]?.balls || 0;

      // Store partnership information BEFORE resetting
      matchState.lastWicket = {
        batsman: outBatsman,
        bowler: bowlerName,
        runs: wicketRuns,
        balls: wicketBalls,
        partnershipRuns: matchState.partnershipRuns,
        partnershipBalls: matchState.partnershipBalls
      };

      // Reset partnership
      matchState.partnershipRuns = 0;
      matchState.partnershipBalls = 0;

      const comment = getCommentary(0, true);

      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | **WICKET!** ${comment}\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;

      ballEvents.push(getBallSymbol(0, true, null));

      await overMessage.edit(commentaryText);
      await sleep(1500);

      if (matchState.wickets >= 10) break;

      // CRITICAL FIX: Get next batsman correctly
      // The next batsman comes from battingOrder at nextBatsmanIdx
      const remainingBatsmen = matchState.battingOrder.slice(matchState.nextBatsmanIdx);

      // Call the selection handler to show the menu
      const newBatsman = await selectNextBatsman(
        interaction,
        remainingBatsmen,
        overNumber,
        inningNumber,
        matchState
      );

      if (!newBatsman) {
        // If no batsman selected (timeout or error), use next from order
        if (matchState.nextBatsmanIdx >= matchState.battingOrder.length) {
          matchState.wickets = 10;
          break;
        }
        const fallbackBatsman = matchState.battingOrder[matchState.nextBatsmanIdx];
        matchState.nextBatsmanIdx++;

        commentaryText += `⚠️ Auto-selecting **${fallbackBatsman}** due to timeout\n`;
        await overMessage.edit(commentaryText);
        await sleep(1000);

        // Initialize stats for fallback batsman
        const fallbackKey = fallbackBatsman.toLowerCase().trim();
        if (!matchState.batsmanStats[fallbackKey]) {
          matchState.batsmanStats[fallbackKey] = {
            name: fallbackBatsman, runs: 0, balls: 0, fours: 0, sixes: 0
          };
        }

        commentaryText += `🏏 **${fallbackBatsman}** walks out to the crease\n`;
        await overMessage.edit(commentaryText);
        await sleep(1500);
        ballsBowled++;
        continue;
      }

      // Initialize stats for new batsman
      const newBatsmanKey = newBatsman.toLowerCase().trim();
      if (!matchState.batsmanStats[newBatsmanKey]) {
        matchState.batsmanStats[newBatsmanKey] = {
          name: newBatsman, runs: 0, balls: 0, fours: 0, sixes: 0
        };
      }

      // Important: The new batsman must be placed in battingOrder at the current striker position
      // But we don't want to mutate the original battingOrder array
      // Instead, we need to track that this position is now occupied by newBatsman
      // For now, we'll update battingOrder at strikerIdx (this is acceptable)
      matchState.battingOrder[matchState.strikerIdx] = newBatsman;

      commentaryText += `🏏 **${newBatsman}** walks out to the crease\n`;
      await overMessage.edit(commentaryText);
      await sleep(1500);

      // strikerIdx remains the same (new batsman on strike)
      ballsBowled++;
      continue;
    }

    // Normal run outcome
    matchState.runs += outcome.runs;
    overRuns += outcome.runs;
    matchState.partnershipRuns += outcome.runs;
    matchState.partnershipBalls++;
    overState.runsInOver += outcome.runs;

    // Track momentum
    if (outcome.isBoundary) {
      overState.boundariesInOver++;
      overState.consecutiveBoundaries++;
      overState.consecutiveDots = 0;
      overState.lastBallWasBoundary = true;
    } else if (outcome.runs === 0) {
      overState.consecutiveDots++;
      overState.consecutiveBoundaries = 0;
      overState.lastBallWasBoundary = false;
    } else {
      overState.consecutiveDots = 0;
      overState.consecutiveBoundaries = 0;
      overState.lastBallWasBoundary = false;
    }

    // Update batsman stats
    const strikerKey = strikerName.toLowerCase().trim();
    if (!matchState.batsmanStats[strikerKey]) {
      matchState.batsmanStats[strikerKey] = { name: strikerName, runs: 0, balls: 0, fours: 0, sixes: 0 };
    }
    matchState.batsmanStats[strikerKey].runs += outcome.runs;
    matchState.batsmanStats[strikerKey].balls++;
    if (outcome.runs === 4) matchState.batsmanStats[strikerKey].fours++;
    if (outcome.runs === 6) matchState.batsmanStats[strikerKey].sixes++;

    // Update bowler stats
    bowlerStats.runs += outcome.runs;

    const comment = getCommentary(outcome.runs, false);
    let momentumText = "";
    if (momentumFactors.bowler >= 10) momentumText = " 🔥 Bowler on fire!";
    else if (momentumFactors.batsman >= 15) momentumText = " 💪 Batsman in full flow!";

    commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | ${outcome.runs} run(s) | ${comment}${momentumText}\n`;
    commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;

    ballEvents.push(getBallSymbol(outcome.runs, false, null));

    await overMessage.edit(commentaryText);

    // STRIKE ROTATION: Swap on odd runs
    if (outcome.runs % 2 === 1) {
      [matchState.strikerIdx, matchState.nonStrikerIdx] = [matchState.nonStrikerIdx, matchState.strikerIdx];
    }

    ballsBowled++;
    await sleep(1000);
  }

  // END OF OVER - Swap strike if all 6 balls were bowled
  // In cricket, after over completes, striker and non-striker swap
  if (ballsBowled === 6 && matchState.wickets < 10 && (!target || matchState.runs < target)) {
    [matchState.strikerIdx, matchState.nonStrikerIdx] = [matchState.nonStrikerIdx, matchState.strikerIdx];
  }

  // END OF OVER SUMMARY
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  const ballString = ballEvents.join(" | ");

  commentaryText += `📈 **Over ${displayOverNumber} Summary:** ${overRuns} runs, ${overWickets} wickets | [ ${ballString} ] \n`;
  // ADD BOWLER STATS FOR CURRENT BOWLER
  const currentBowlerStats = matchState.bowlerStats.get(bowlerName);
  if (currentBowlerStats) {
    const bowlerOvers = currentBowlerStats.overs;
    const bowlerRuns = currentBowlerStats.runs;
    const bowlerWickets = currentBowlerStats.wickets;
    const bowlerEcon = (bowlerRuns / bowlerOvers).toFixed(2);
    commentaryText += `🎯 **${bowlerName}:** ${bowlerOvers}.0-${bowlerRuns}-${bowlerWickets} (Econ: ${bowlerEcon})\n`;
  }

  // Only show batsmen stats if they exist
  if (matchState.strikerIdx < matchState.battingOrder.length) {
    const strikerName = matchState.battingOrder[matchState.strikerIdx];
    const nonStrikerName = matchState.battingOrder[matchState.nonStrikerIdx];

    const strikerStats = matchState.batsmanStats[strikerName.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
    const nonStrikerStats = matchState.batsmanStats[nonStrikerName.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };

    commentaryText += `📊 **${matchState.battingTeam.teamName}:** ${matchState.runs}/${matchState.wickets} (${displayOverNumber} overs)\n`;
    commentaryText += `🏏 **${strikerName}:** ${strikerStats.runs}* off ${strikerStats.balls} balls`;
    if (strikerStats.fours > 0) commentaryText += ` (${strikerStats.fours}×4)`;
    if (strikerStats.sixes > 0) commentaryText += ` (${strikerStats.sixes}×6)`;
    commentaryText += `\n`;
    commentaryText += `🏏 **${nonStrikerName}:** ${nonStrikerStats.runs} off ${nonStrikerStats.balls} balls`;
    if (nonStrikerStats.fours > 0) commentaryText += ` (${nonStrikerStats.fours}×4)`;
    if (nonStrikerStats.sixes > 0) commentaryText += ` (${nonStrikerStats.sixes}×6)`;
    commentaryText += `\n`;

    commentaryText += `🤝 **Partnership:** ${matchState.partnershipRuns} runs (${matchState.partnershipBalls} balls)\n`;
  }

  if (matchState.lastWicket && matchState.wickets > 0) {
    const lastWicket = matchState.lastWicket;
    commentaryText += `💀 **Last Wicket:** ${lastWicket.batsman} b ${lastWicket.bowler} ${lastWicket.runs}(${lastWicket.balls}) | Partnership: ${lastWicket.partnershipRuns} runs\n`;
  }

  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  await overMessage.edit(commentaryText);

  return { inningsComplete: false, overRuns, overWickets };
}

// Helper functions for momentum and extras
function getMomentumFactors(overState, ballNumber) {
  const {
    runsInOver,
    wicketsInOver,
    boundariesInOver,
    consecutiveDots,
    consecutiveBoundaries
  } = overState;

  let bowlerMomentum = 0;
  let batsmanMomentum = 0;

  if (consecutiveDots >= 2) bowlerMomentum += 5;
  if (consecutiveDots >= 3) bowlerMomentum += 8;
  if (consecutiveDots >= 4) bowlerMomentum += 12;

  if (consecutiveBoundaries >= 1) batsmanMomentum += 10;
  if (consecutiveBoundaries >= 2) batsmanMomentum += 20;

  if (wicketsInOver > 0) bowlerMomentum += 15 * wicketsInOver;

  if (runsInOver >= 15) bowlerMomentum -= 10;
  if (runsInOver >= 20) bowlerMomentum -= 20;

  if (overState.lastBallWasBoundary) batsmanMomentum += 15;

  return { bowlerMomentum, batsmanMomentum };
}

function getExtra(bowler, bowlerMomentum = 0) {
  const controlRating = (bowler.control || 50) / 100;
  const momentumEffect = bowlerMomentum < 0 ? Math.abs(bowlerMomentum) / 10 : 0;
  const extraChance = Math.max(1.5, Math.min(8, 6 - (controlRating * 5) + momentumEffect));

  if (Math.random() * 100 < extraChance) {
    return Math.random() < 0.4 ? { type: "noball", runs: 1 } : { type: "wide", runs: 1 };
  }
  return null;
}

module.exports = { playOver };