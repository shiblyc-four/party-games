import { ArraySchema } from '@colyseus/schema';
import { GameState, GuessEntrySchema } from '../state/GameState.js';
import { pickRandomWords, generateHint, revealLetter, TIMING } from '@pulsing-supernova/shared';
import { TeamController } from './TeamController.js';
import { ScoreController } from './ScoreController.js';
import type { Room } from '@colyseus/core';

/**
 * RoundController — manages the game loop: phase transitions, timers,
 * word selection, guess validation, and hint reveals.
 */
export class RoundController {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private hintTimer: ReturnType<typeof setInterval> | null = null;
    private currentWord: string = '';
    private wordChoicesCache: string[] = [];

    constructor(
        private state: GameState,
        private teamCtrl: TeamController,
        private scoreCtrl: ScoreController,
        private room: Room,
    ) { }

    /** Start the game — transition from lobby/team-select to first round */
    startGame(): void {
        this.state.currentRound = 0;
        this.state.activeTeamIndex = 0;
        this.state.winningTeamIndex = -1;

        // Reset team scores
        this.state.teams.forEach((team) => {
            team.score = 0;
        });

        this.startNextRound();
    }

    /** Begin a new round — pick drawer, offer word choices */
    startNextRound(): void {
        this.state.currentRound++;
        this.clearTimers();

        // Clear previous round data
        this.state.guesses = new ArraySchema<GuessEntrySchema>();
        this.state.wordHint = '';
        this.currentWord = '';

        // Find next team with players (skip empty teams)
        let attempts = 0;
        while (attempts < this.state.teams.length) {
            const team = this.state.teams[this.state.activeTeamIndex];
            if (team.drawerQueue.length > 0) break;
            this.state.activeTeamIndex =
                (this.state.activeTeamIndex + 1) % this.state.teams.length;
            attempts++;
        }

        // Get next drawer
        const drawerId = this.teamCtrl.getNextDrawer(this.state.activeTeamIndex);
        if (!drawerId) return;

        this.state.currentDrawer = drawerId;
        this.teamCtrl.assignRoles(drawerId, this.state.activeTeamIndex);

        // Generate word choices
        this.wordChoicesCache = pickRandomWords(
            this.state.settings.wordCategory,
            3
        );

        // Send word choices privately to drawer
        const drawerClient = this.room.clients.find(
            (c) => c.sessionId === drawerId
        );
        if (drawerClient) {
            drawerClient.send('wordChoices', {
                words: this.wordChoicesCache,
            });
        }

        this.state.phase = 'word-select';

        // Auto-pick timer (15 seconds)
        this.timer = setTimeout(() => {
            this.selectWord(Math.floor(Math.random() * 3));
        }, TIMING.WORD_CHOICE_TIME * 1000);
    }

    /** Drawer selects a word */
    selectWord(index: number): void {
        if (index < 0 || index >= this.wordChoicesCache.length) return;

        this.clearTimers();

        this.currentWord = this.wordChoicesCache[index];
        this.state.wordHint = generateHint(this.currentWord);
        this.state.timeRemaining = this.state.settings.drawTime;
        this.state.phase = 'drawing';

        // Send the secret word to the drawer only
        const drawerClient = this.room.clients.find(
            (c) => c.sessionId === this.state.currentDrawer
        );
        if (drawerClient) {
            drawerClient.send('secretWord', { word: this.currentWord });
        }

        // Start countdown timer
        this.timer = setInterval(() => {
            this.state.timeRemaining--;

            if (this.state.timeRemaining <= 0) {
                this.endRound(false);
            }
        }, 1000);

        // Start hint reveal timer
        this.hintTimer = setInterval(() => {
            this.state.wordHint = revealLetter(this.currentWord, this.state.wordHint);
        }, TIMING.HINT_INTERVAL * 1000);
    }

    /** Process a guess from a player */
    processGuess(
        playerId: string,
        nickname: string,
        guessText: string
    ): boolean {
        const normalized = guessText.trim().toLowerCase();
        const answer = this.currentWord.toLowerCase();
        const isCorrect = normalized === answer;

        // Add to guess log
        const entry = new GuessEntrySchema();
        entry.playerId = playerId;
        entry.nickname = nickname;
        entry.text = isCorrect ? '✓ Correct!' : guessText; // Don't reveal answer in wrong guesses
        entry.isCorrect = isCorrect;
        entry.timestamp = Date.now();
        this.state.guesses.push(entry);

        if (isCorrect) {
            // Score the point
            this.scoreCtrl.awardPoint(this.state.activeTeamIndex);

            // Broadcast correct guess event
            this.room.broadcast('correctGuess', {
                playerId,
                nickname,
                word: this.currentWord,
            });

            this.endRound(true);
        }

        return isCorrect;
    }

    /** End the current round */
    private endRound(wasCorrect: boolean): void {
        this.clearTimers();

        this.state.phase = 'round-end';

        // Broadcast round result
        this.room.broadcast('roundResult', {
            word: this.currentWord,
            wasCorrect,
            teamIndex: this.state.activeTeamIndex,
            teamName: this.state.teams[this.state.activeTeamIndex].name,
        });

        // Check win condition
        const winner = this.scoreCtrl.checkWinCondition();
        if (winner !== -1) {
            setTimeout(() => {
                this.state.winningTeamIndex = winner;
                this.state.phase = 'game-over';
            }, TIMING.ROUND_END_DELAY * 1000);
            return;
        }

        // Move to next team
        this.state.activeTeamIndex =
            (this.state.activeTeamIndex + 1) % this.state.teams.length;

        // Start next round after delay
        setTimeout(() => {
            this.startNextRound();
        }, TIMING.ROUND_END_DELAY * 1000);
    }

    /** Clear all timers */
    clearTimers(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.hintTimer) {
            clearInterval(this.hintTimer);
            this.hintTimer = null;
        }
    }

    /** Reset for a new game */
    reset(): void {
        this.clearTimers();
        this.currentWord = '';
        this.wordChoicesCache = [];
    }
}
