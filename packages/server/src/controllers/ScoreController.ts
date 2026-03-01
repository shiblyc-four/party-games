import { GameState } from '../state/GameState.js';

/**
 * ScoreController — tracks points and checks win conditions.
 * Flat scoring: 1 point per correct guess, no speed bonus.
 */
export class ScoreController {
    constructor(private state: GameState) { }

    /** Award a point to a team */
    awardPoint(teamIndex: number): void {
        const team = this.state.teams[teamIndex];
        if (team) {
            team.score++;
        }
    }

    /**
     * Check if a team has met the win condition.
     * Returns the winning team index, or -1 if no winner yet.
     */
    checkWinCondition(): number {
        const { winMode, targetScore, totalRounds } = this.state.settings;

        if (winMode === 'points') {
            // First to N points wins
            for (let i = 0; i < this.state.teams.length; i++) {
                if (this.state.teams[i]!.score >= targetScore) {
                    return i;
                }
            }
        } else if (winMode === 'rounds') {
            // After R rounds, highest score wins
            if (this.state.currentRound >= totalRounds) {
                let maxScore = -1;
                let winnerIdx = -1;
                for (let i = 0; i < this.state.teams.length; i++) {
                    if (this.state.teams[i]!.score > maxScore) {
                        maxScore = this.state.teams[i]!.score;
                        winnerIdx = i;
                    }
                }
                return winnerIdx;
            }
        }

        return -1;
    }

    /** Reset all scores */
    resetScores(): void {
        this.state.teams.forEach((team) => {
            team.score = 0;
        });
    }

    // ─── FFA scoring ────────────────────────────────────────────────

    /** Award a point to a specific player by session ID */
    awardPlayerPoint(sessionId: string): void {
        const current = this.state.playerScores.get(sessionId) ?? 0;
        this.state.playerScores.set(sessionId, current + 1);
    }

    /**
     * Check FFA win condition.
     * Returns an array of winner session IDs:
     * - Single element  = one winner, go to game-over
     * - Multiple elements = tied, trigger sudden death
     * - Empty array = no winner yet (game continues)
     */
    checkFFAWinCondition(): string[] {
        const { winMode, targetScore, totalRounds } = this.state.settings;

        // Build score map from state
        const scores: Map<string, number> = new Map();
        this.state.playerScores.forEach((score, sessionId) => {
            scores.set(sessionId, score);
        });

        let maxScore = 0;
        scores.forEach((score) => {
            if (score > maxScore) maxScore = score;
        });

        if (winMode === 'points') {
            if (maxScore < targetScore) return []; // nobody reached target yet
        } else {
            // rounds mode — only check after target round count
            if (this.state.currentRound < totalRounds) return [];
        }

        if (maxScore === 0) return [];

        // Collect all tied leaders
        const winners: string[] = [];
        scores.forEach((score, sessionId) => {
            if (score === maxScore) winners.push(sessionId);
        });
        return winners;
    }

    /** Reset all FFA player scores */
    resetPlayerScores(): void {
        this.state.playerScores.clear();
    }
}
