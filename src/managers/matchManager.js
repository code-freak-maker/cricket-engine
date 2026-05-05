class MatchManager {
    constructor() {
        this.matches = new Map(); // channelId -> matchState
        this.timeouts = new Map();
    }

    createMatch(channelId, matchState) {
        // Clean up any existing match first
        this.deleteMatch(channelId);
        this.matches.set(channelId, matchState);
        this._setInactivityTimeout(channelId);
    }

    getMatch(channelId) {
        return this.matches.get(channelId);
    }

    hasActiveMatch(channelId) {
        const match = this.matches.get(channelId);
        return match && match.isActive === true && match.stopped !== true;
    }

    getAllActiveMatches() {
        const activeMatches = [];
        for (const [channelId, match] of this.matches) {
            if (match?.isActive && !match?.stopped) {
                activeMatches.push({
                    channelId,
                    teamA: match.teamA?.teamName,
                    teamB: match.teamB?.teamName,
                    score: `${match.runs}/${match.wickets}`,
                    over: match.currentOver,
                    stadium: match.stadium?.name
                });
            }
        }
        return activeMatches;
    }

    updateMatch(channelId, updates) {
        const match = this.matches.get(channelId);
        if (!match) return;
        Object.assign(match, updates);
        this.matches.set(channelId, match);
    }

    stopMatch(channelId, { reason = "No reason", stoppedBy = "System" } = {}) {
        const match = this.matches.get(channelId);
        if (!match) return false;

        match.isActive = false;
        match.stopped = true;
        match.stopReason = reason;
        match.stoppedBy = stoppedBy;

        this.matches.set(channelId, match);

        if (this.timeouts.has(channelId)) {
            clearTimeout(this.timeouts.get(channelId));
            this.timeouts.delete(channelId);
        }

        return true;
    }

    deleteMatch(channelId) {
        if (this.timeouts.has(channelId)) {
            clearTimeout(this.timeouts.get(channelId));
            this.timeouts.delete(channelId);
        }
        this.matches.delete(channelId);
    }

    _setInactivityTimeout(channelId) {
        if (this.timeouts.has(channelId)) {
            clearTimeout(this.timeouts.get(channelId));
        }

        const timeout = setTimeout(() => {
            const match = this.matches.get(channelId);
            if (match?.isActive) {
                match.isActive = false;
                match.expired = true;
                this.matches.set(channelId, match);
            }
        }, 30 * 60 * 1000);

        this.timeouts.set(channelId, timeout);
    }
}

module.exports = new MatchManager();