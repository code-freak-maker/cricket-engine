// engine/matchEngine.js - Fixed version with ONLY simulateBall
const random = (min, max) => Math.random() * (max - min) + min;

function normalRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

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

function getBattingSkill(batsman, stadium, isPowerplay, isDeath, isPacerBowler, batsmanMomentum = 0) {
  let skill = (batsman.technique || 50) * 0.25 +
    (batsman.power || 50) * 0.20 +
    (batsman.timing || 50) * 0.25 +
    (batsman.aggression || 50) * 0.15 +
    (batsman.consistency || 50) * 0.15;

  if (isPacerBowler) {
    skill *= (batsman.againstPace || 50) / 50;
  } else {
    skill *= (batsman.againstSpin || 50) / 50;
  }

  skill *= (stadium.batting / 5);
  if (isPowerplay) skill *= 1.1;
  if (isDeath) skill *= 1.05;

  skill += batsmanMomentum;

  return Math.min(130, Math.max(20, skill));
}

function getBowlingSkill(bowler, stadium, isPowerplay, isDeath, isPacer, bowlerMomentum = 0) {
  let skill = 0;

  if (isPacer) {
    skill = (bowler.paceSkill || 50) * 0.35 +
      (bowler.movement || 50) * 0.35 +
      (bowler.control || 50) * 0.30;
    skill *= (stadium.pace / 5) * (stadium.swing / 5);
  } else {
    skill = (bowler.spinSkill || 50) * 0.40 +
      (bowler.turn || 50) * 0.30 +
      (bowler.control || 50) * 0.30;
    skill *= (stadium.turn / 5);
  }

  if (isPowerplay) skill *= 0.9;
  if (isDeath) skill *= (bowler.deathBowling || 50) / 50;

  skill += bowlerMomentum;

  return Math.min(110, Math.max(20, skill));
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

function getBoundaryModifier(stadium) {
  if (stadium.boundarySize >= 8) return 0.6;
  if (stadium.boundarySize >= 6) return 0.8;
  if (stadium.boundarySize >= 4) return 1.0;
  return 1.2;
}

function simulateBall(batsman, bowler, stadium, overNumber, isFreeHit = false, momentumFactors = { bowler: 0, batsman: 0 }) {
  const isPowerplay = overNumber <= 6;
  const isDeath = overNumber >= 16;
  const isPacer = (bowler.role || "").toLowerCase().includes("fast") ||
    (bowler.role || "").toLowerCase().includes("pace");

  let battingSkill = getBattingSkill(batsman, stadium, isPowerplay, isDeath, isPacer, momentumFactors.batsman);
  let bowlingSkill = getBowlingSkill(bowler, stadium, isPowerplay, isDeath, isPacer, momentumFactors.bowler);

  let net = battingSkill - bowlingSkill + normalRandom(0, 15);

  const boundaryMod = getBoundaryModifier(stadium);

  let wicketChance = isFreeHit ? 0.5 : (4 + (bowlingSkill - battingSkill) / 20);

  if (momentumFactors.bowler > 0) {
    wicketChance += momentumFactors.bowler / 10;
  }

  if (momentumFactors.batsman > 0) {
    wicketChance -= momentumFactors.batsman / 15;
  }

  wicketChance = Math.min(15, Math.max(1.5, wicketChance));

  if (Math.random() * 100 < wicketChance && !isFreeHit) {
    return { type: "wicket", runs: 0 };
  }

  let runs = 0;
  const rand = Math.random() * 100;
  let adjustedNet = net;

  if (momentumFactors.batsman > 0) {
    adjustedNet += momentumFactors.batsman / 2;
  }

  if (momentumFactors.bowler > 0) {
    adjustedNet -= momentumFactors.bowler / 2;
  }

  if (adjustedNet > 85) {
    if (rand < 45) runs = 6;
    else if (rand < 75) runs = 4;
    else if (rand < 88) runs = 2;
    else runs = 1;
  } else if (adjustedNet > 55) {
    if (rand < 12) runs = 6;
    else if (rand < 28) runs = 4;
    else if (rand < 55) runs = 2;
    else if (rand < 85) runs = 1;
    else runs = 0;
  } else if (adjustedNet > 25) {
    if (rand < 4) runs = 6;
    else if (rand < 12) runs = 4;
    else if (rand < 40) runs = 2;
    else if (rand < 70) runs = 1;
    else runs = 0;
  } else if (adjustedNet > 0) {
    if (rand < 1.5) runs = 6;
    else if (rand < 7) runs = 4;
    else if (rand < 30) runs = 2;
    else if (rand < 60) runs = 1;
    else runs = 0;
  } else {
    if (rand < 3) runs = 4;
    else if (rand < 18) runs = 2;
    else if (rand < 45) runs = 1;
    else runs = 0;
  }

  if (runs === 4 || runs === 6) {
    if (Math.random() > boundaryMod) {
      runs = runs === 4 ? 2 : 3;
    }
  }
  
  const speed = isPacer ? (Math.random() * 35 + 120).toFixed(1) : (Math.random() * 40 + 70).toFixed(1);

  return { 
    type: "run", 
    runs: runs, 
    isBoundary: (runs === 4 || runs === 6), 
    speed: speed 
  };
}

module.exports = { simulateBall };