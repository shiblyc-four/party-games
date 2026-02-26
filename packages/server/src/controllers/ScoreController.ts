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
}
