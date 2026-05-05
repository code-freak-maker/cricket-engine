// utils/matchHelpers.js

function formatOverSummary(overResult, overNumber, state, bowler, bowlerStats, batsmanStats, strikerIdx, nonStrikerIdx, battingOrder) {
  const eventsStr = overResult.ballEvents.join(" • ");
  const strikerName = battingOrder[strikerIdx] || "?";
  const nonStrikerName = battingOrder[nonStrikerIdx] || "?";
  const striker = batsmanStats[strikerName?.toLowerCase()] || { runs: 0, balls: 0 };
  const nonStriker = batsmanStats[nonStrikerName?.toLowerCase()] || { runs: 0, balls: 0 };
  
  const strikerDisplay = `${strikerName}:${striker.runs}* (${striker.balls})`;
  const nonStrikerDisplay = `${nonStrikerName}:${nonStriker.runs} (${nonStriker.balls})`;
  
  // FIX: Use overs directly, not overs.ballsInOver
  const oversDisplay = bowlerStats.overs;
  const runsDisplay = bowlerStats.runs;
  const wicketsDisplay = bowlerStats.wickets;
  
  let summary = `End of Over ${overNumber} | Score ${state.runs}/${state.wickets} | ${strikerDisplay} | ${nonStrikerDisplay} | ${bowler.name}: ${oversDisplay}.0-${runsDisplay}-${wicketsDisplay}
This over: ${overResult.overRuns} runs, ${overResult.overWickets} wickets | ${eventsStr}
Partnership: ${state.partnershipRuns} off ${state.partnershipBalls} | Last Wicket: ${state.lastWicket ? `${state.lastWicket.batsman} ${state.lastWicket.runs} (${state.lastWicket.balls})` : "None"}`;
  
  return summary;
}

function formatBowlerDisplay(bowler, stats, playersMap) {
  const player = playersMap.get(bowler.toLowerCase().trim());
  if (!player) return bowler;
  
  const overs = stats.overs;
  const runs = stats.runs;
  const wickets = stats.wickets;
  const economy = overs > 0 ? (runs / overs).toFixed(2) : "0.00";
  
  let status = "";
  if (stats.overs === 0) status = " (Not bowled yet)";
  else if (stats.wickets > 0) status = ` (${overs} ov, ${runs} runs, ${wickets} wkts, Eco: ${economy})`;
  else status = ` (${overs} ov, ${runs} runs, Eco: ${economy})`;
  
  return `${player.name}${status}`;
}

function getTimeRemaining(seconds) {
  if (seconds <= 0) return "expired";
  return `${seconds} seconds remaining`;
}

function createBatsmanDropdown(batsmen, timeoutSeconds) {
  return {
    content: `⚔️ **Select next batsman** (You have ${timeoutSeconds} seconds):`,
    options: batsmen.map(name => ({ label: name, value: name }))
  };
}

function createBowlerDropdown(bowlers, timeoutSeconds) {
  return {
    content: `🎯 **Select bowler for next over** (You have ${timeoutSeconds} seconds):`,
    options: bowlers.map(b => ({ label: b.name, value: b.name, description: b.display }))
  };
}

module.exports = { 
  formatOverSummary, 
  formatBowlerDisplay, 
  getTimeRemaining,
  createBatsmanDropdown,
  createBowlerDropdown
};