import { ArraySchema } from '@colyseus/schema';
import { GameState, GuessEntrySchema } from '../state/GameState.js';
import { pickRandomWords, generateHint, revealLetter, TIMING } from '@pulsing-supernova/shared';
import { TeamController } from './TeamController.js';
import { ScoreController } from './ScoreController.js';
import { GameRoom } from '../rooms/GameRoom.js';

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
        private room: GameRoom,
    ) { }

    /** Start the game — transition from lobby/team-select to first round */
    startGame(): void {
        this.state.currentRound = 0;
        this.state.activeTeamIndex = 0;
        this.state.winningTeamIndex = -1;
        this.state.isSuddenDeath = false;
        this.state.winnerSessionIds.clear();

        const isFFA = this.state.settings.gameMode === 'ffa';

        if (isFFA) {
            // FFA: init per-player scores and global drawer queue
            this.scoreCtrl.resetPlayerScores();
            this.teamCtrl.initFFA();
        } else {
            // Teams: reset team scores
            this.state.teams.forEach((team) => {
                team.score = 0;
            });
        }

        this.startNextRound();
    }

    /** Begin a new round — pick drawer, offer word choices */
    startNextRound(): void {
        this.state.currentRound++;
        this.clearTimers();
        this.room.clearCanvas();

        // Clear previous round data
        this.state.guesses = new ArraySchema<GuessEntrySchema>();
        this.state.wordHint = '';
        this.currentWord = '';

        const isFFA = this.state.settings.gameMode === 'ffa';

        let drawerId: string | null;

        if (isFFA) {
            drawerId = this.teamCtrl.getNextFFADrawer();
            if (!drawerId) return;
            this.state.currentDrawer = drawerId;
            this.teamCtrl.assignFFARoles(drawerId);
        } else {
            // Teams mode: find next team with players (skip empty teams)
            let attempts = 0;
            while (attempts < this.state.teams.length) {
                const team = this.state.teams[this.state.activeTeamIndex];
                if (team && team.drawerQueue.length > 0) break;
                this.state.activeTeamIndex =
                    (this.state.activeTeamIndex + 1) % this.state.teams.length;
                attempts++;
            }

            drawerId = this.teamCtrl.getNextDrawer(this.state.activeTeamIndex);
            if (!drawerId) return;
            this.state.currentDrawer = drawerId;
            this.teamCtrl.assignRoles(drawerId, this.state.activeTeamIndex);
        }

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
        entry.text = isCorrect ? '✓ Correct!' : guessText;
        entry.isCorrect = isCorrect;
        entry.timestamp = Date.now();
        this.state.guesses.push(entry);

        if (isCorrect) {
            const isFFA = this.state.settings.gameMode === 'ffa';

            if (isFFA) {
                if (this.state.isSuddenDeath) {
                    // Sudden death winner — end game immediately
                    this.room.broadcast('correctGuess', { playerId, nickname, word: this.currentWord });
                    this.endSuddenDeathWin(playerId);
                } else {
                    // Normal FFA round: award point to guessing player
                    this.scoreCtrl.awardPlayerPoint(playerId);
                    this.room.broadcast('correctGuess', { playerId, nickname, word: this.currentWord });
                    this.endRound(true);
                }
            } else {
                // Teams mode: award point to active team
                this.scoreCtrl.awardPoint(this.state.activeTeamIndex);
                this.room.broadcast('correctGuess', { playerId, nickname, word: this.currentWord });
                this.endRound(true);
            }
        }

        return isCorrect;
    }

    /** End the current round */
    private endRound(wasCorrect: boolean): void {
        this.clearTimers();
        this.state.phase = 'round-end';

        const isFFA = this.state.settings.gameMode === 'ffa';

        // Broadcast round result
        this.room.broadcast('roundResult', {
            word: this.currentWord,
            wasCorrect,
            teamIndex: this.state.activeTeamIndex,
            teamName: isFFA ? '' : (this.state.teams[this.state.activeTeamIndex]?.name ?? ''),
        });

        if (isFFA) {
            // Check FFA win condition
            const winners = this.scoreCtrl.checkFFAWinCondition();
            if (winners.length === 1) {
                // Clear winner
                setTimeout(() => {
                    this.state.winnerSessionIds.clear();
                    winners.forEach(id => this.state.winnerSessionIds.push(id));
                    this.state.phase = 'game-over';
                }, TIMING.ROUND_END_DELAY * 1000);
                return;
            } else if (winners.length > 1) {
                // Tied — trigger sudden death
                setTimeout(() => {
                    this.startSuddenDeath(winners);
                }, TIMING.ROUND_END_DELAY * 1000);
                return;
            }
        } else {
            // Teams mode win condition
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
        }

        // Start next round after delay
        setTimeout(() => {
            this.startNextRound();
        }, TIMING.ROUND_END_DELAY * 1000);
    }

    /**
     * Start a sudden death round to resolve a tie.
     * A non-tied player is chosen as drawer; only tied players can win.
     */
    private startSuddenDeath(tiedIds: string[]): void {
        this.clearTimers();

        this.state.isSuddenDeath = true;
        this.state.winnerSessionIds.clear();
        tiedIds.forEach(id => this.state.winnerSessionIds.push(id));

        // Clear round data
        this.state.guesses = new ArraySchema<GuessEntrySchema>();
        this.state.wordHint = '';
        this.currentWord = '';

        const drawerId = this.teamCtrl.getSuddenDeathDrawer(tiedIds);
        if (!drawerId) {
            // Fallback: everybody wins
            this.state.phase = 'game-over';
            return;
        }

        this.state.currentDrawer = drawerId;
        // In sudden death, tied players = guessers, drawer = drawer, others = spectators
        this.state.players.forEach((player) => {
            if (player.sessionId === drawerId) {
                player.role = 'drawer';
            } else if (tiedIds.includes(player.sessionId)) {
                player.role = 'guesser';
            } else {
                player.role = 'spectator';
            }
        });

        // Generate word choices
        this.wordChoicesCache = pickRandomWords(this.state.settings.wordCategory, 3);
        const drawerClient = this.room.clients.find(c => c.sessionId === drawerId);
        if (drawerClient) {
            drawerClient.send('wordChoices', { words: this.wordChoicesCache });
        }

        this.state.phase = 'word-select';

        // Auto-pick if drawer doesn't choose
        this.timer = setTimeout(() => {
            this.selectWord(Math.floor(Math.random() * 3));
        }, TIMING.WORD_CHOICE_TIME * 1000);
    }

    /** Immediately end the game when sudden death is resolved */
    private endSuddenDeathWin(winnerSessionId: string): void {
        this.clearTimers();
        this.state.isSuddenDeath = false;
        this.state.winnerSessionIds.clear();
        this.state.winnerSessionIds.push(winnerSessionId);
        this.state.phase = 'game-over';
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
        this.state.isSuddenDeath = false;
        this.state.winnerSessionIds.clear();
    }
}
