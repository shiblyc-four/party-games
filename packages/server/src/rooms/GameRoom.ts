import { Room, Client } from '@colyseus/core';
import { ArraySchema } from '@colyseus/schema';
import {
    GameState,
    PlayerSchema,
    GameSettingsSchema,
    ChatEntrySchema,
} from '../state/GameState.js';
import { TeamController } from '../controllers/TeamController.js';
import { RoundController } from '../controllers/RoundController.js';
import { ScoreController } from '../controllers/ScoreController.js';
import {
    MSG,
    AVATAR_COLORS,
    DEFAULT_SETTINGS,
} from '@pulsing-supernova/shared';
import type { IDrawStroke, GameMode } from '@pulsing-supernova/shared';

interface JoinOptions {
    nickname: string;
}

/**
 * GameRoom — main Colyseus room for a Pictionary game session.
 * Handles all client messages and delegates to controllers.
 */
export class GameRoom extends Room<GameState> {
    private teamCtrl!: TeamController;
    private roundCtrl!: RoundController;
    private scoreCtrl!: ScoreController;
    private colorIndex = 0;

    // Track stroke history on the server for late joiners / reconnection
    private strokeHistory: IDrawStroke[] = [];

    onCreate(): void {
        this.setState(new GameState());
        this.state.roomCode = this.generateRoomCode();
        this.maxClients = 16;

        // Expose room code as metadata so clients can find rooms by code
        this.setMetadata({ roomCode: this.state.roomCode });

        this.teamCtrl = new TeamController(this.state);
        this.scoreCtrl = new ScoreController(this.state);
        this.roundCtrl = new RoundController(
            this.state,
            this.teamCtrl,
            this.scoreCtrl,
            this
        );

        // Initialize 2 default teams (switched to FFA later if host picks FFA)
        this.teamCtrl.initTeams(2);

        // Start at mode-select phase so host can pick Teams or FFA
        this.state.phase = 'mode-select';

        this.registerMessageHandlers();

        console.log(`🎮 Room ${this.state.roomCode} created`);
    }

    onJoin(client: Client, options: JoinOptions): void {
        const nickname = options.nickname || `Player ${this.clients.length}`;

        // ── Check for disconnected player with matching nickname ──
        let reconnected = false;
        for (const [oldSessionId, oldPlayer] of this.state.players.entries()) {
            if (
                !oldPlayer.isConnected &&
                oldPlayer.nickname.toLowerCase() === nickname.toLowerCase()
            ) {
                // Found a matching disconnected player — restore them
                const player = new PlayerSchema();
                player.sessionId = client.sessionId;
                player.nickname = oldPlayer.nickname;
                player.avatarColor = oldPlayer.avatarColor;
                player.teamIndex = oldPlayer.teamIndex;
                player.role = oldPlayer.role;
                player.isHost = oldPlayer.isHost;
                player.isConnected = true;

                // Update the drawer queue: replace old session ID with new one
                if (player.teamIndex >= 0) {
                    const team = this.state.teams[player.teamIndex];
                    if (team) {
                        const queueIdx = team.drawerQueue.indexOf(oldSessionId);
                        if (queueIdx !== -1) {
                            team.drawerQueue.setAt(queueIdx, client.sessionId);
                        } else {
                            // Wasn't in queue (maybe removed on disconnect), re-add
                            team.drawerQueue.push(client.sessionId);
                        }
                    }
                }

                // If this player was the current drawer, update that too
                if (this.state.currentDrawer === oldSessionId) {
                    this.state.currentDrawer = client.sessionId;
                }

                // Remove old entry, add new one
                this.state.players.delete(oldSessionId);
                this.state.players.set(client.sessionId, player);

                reconnected = true;
                console.log(
                    `🔄 ${player.nickname} reconnected to room ${this.state.roomCode} (team: ${player.teamIndex}, role: ${player.role})`
                );
                break;
            }
        }

        if (!reconnected) {
            // Brand new player
            const player = new PlayerSchema();
            player.sessionId = client.sessionId;
            player.nickname = nickname;
            player.avatarColor =
                AVATAR_COLORS[this.colorIndex % AVATAR_COLORS.length];
            player.teamIndex = -1;
            player.role = 'spectator';
            player.isHost = this.clients.length === 1; // First player is host
            player.isConnected = true;

            this.state.players.set(client.sessionId, player);
            this.colorIndex++;

            console.log(
                `👤 ${player.nickname} joined room ${this.state.roomCode}`
            );
        }

        // Send stroke history to late joiners / reconnecting players during drawing phase
        if (
            this.state.phase === 'drawing' &&
            this.strokeHistory.length > 0
        ) {
            client.send('strokeHistory', this.strokeHistory);
        }
    }

    async onLeave(client: Client, consented: boolean): Promise<void> {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        if (consented) {
            // Intentional leave — remove them immediately
            this.teamCtrl.handleDisconnect(player);
            this.state.players.delete(client.sessionId);

            // Re-assign host if needed
            if (player.isHost && this.clients.length > 0) {
                const nextHost = this.state.players.values().next().value;
                if (nextHost) nextHost.isHost = true;
            }

            console.log(`👋 ${player.nickname} left room ${this.state.roomCode}`);
        } else {
            // Unintentional disconnect — keep them in state as disconnected
            this.teamCtrl.handleDisconnect(player);
            console.log(`⚡ ${player.nickname} disconnected from room ${this.state.roomCode} — awaiting reconnect...`);

            try {
                // Wait up to 20 seconds for the client to reconnect
                const newClient = await this.allowReconnection(client, 20);

                // Client reconnected successfully!
                this.teamCtrl.handleReconnect(player);
                console.log(`🔄 ${player.nickname} reconnected automatically gracefully!`);

                // Send stroke history to reconnected player during drawing phase
                if (
                    this.state.phase === 'drawing' &&
                    this.strokeHistory.length > 0
                ) {
                    newClient.send('strokeHistory', this.strokeHistory);
                }
            } catch (e) {
                // Time expired or another error occurred - remove them
                console.log(`🔌 ${player.nickname} failed to reconnect in time. Removing...`);
                this.state.players.delete(client.sessionId);

                if (player.isHost && this.clients.length > 0) {
                    const nextHost = this.state.players.values().next().value;
                    if (nextHost) nextHost.isHost = true;
                }
            }
        }

        // If room is now completely empty (all clients gone), dispose
        if (this.clients.length === 0) {
            this.disconnect();
        }
    }

    onDispose(): void {
        this.roundCtrl.clearTimers();
        console.log(`🗑️ Room ${this.state.roomCode} disposed`);
    }

    // ─── Message Handlers ───────────────────────────────────

    private registerMessageHandlers(): void {
        // ─── Game mode selection (host only, in mode-select phase) ──────────────────────
        this.onMessage(MSG.SET_GAME_MODE, (client, data: { gameMode: GameMode }) => {
            if (this.state.phase !== 'mode-select') return;
            const player = this.state.players.get(client.sessionId);
            if (!player?.isHost) {
                client.send('error', { message: 'Only the host can select the game mode.' });
                return;
            }
            const mode = data.gameMode;
            if (mode !== 'teams' && mode !== 'ffa') {
                client.send('error', { message: 'Invalid game mode.' });
                return;
            }

            this.state.settings.gameMode = mode;

            if (mode === 'teams') {
                // Reset teams if previously cleared (e.g. after a FFA game)
                if (this.state.teams.length === 0) {
                    this.teamCtrl.initTeams(2);
                }
                this.state.phase = 'lobby'; // proceed to team-select
            } else {
                // FFA: skip team-select, stay in mode-select
                // Phase stays 'mode-select'; host will send START_GAME when ready
                this.state.phase = 'lobby'; // reuse lobby phase for FFA waiting room
            }

            console.log(`🎮 Room ${this.state.roomCode} mode set to: ${mode}`);
        });

        // Join team
        this.onMessage(MSG.JOIN_TEAM, (client, data: { teamIndex: number }) => {
            if (this.state.phase !== 'lobby' && this.state.phase !== 'team-select')
                return;
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            this.teamCtrl.joinTeam(player, data.teamIndex);
        });

        // Spectate
        this.onMessage(MSG.SPECTATE, (client) => {
            if (this.state.phase !== 'lobby' && this.state.phase !== 'team-select')
                return;
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            this.teamCtrl.setSpectator(player);
        });

        // Start game (host only)
        this.onMessage(
            MSG.START_GAME,
            (client, data?: { settings?: Partial<typeof DEFAULT_SETTINGS> }) => {
                const player = this.state.players.get(client.sessionId);
                if (!player?.isHost) {
                    client.send('error', { message: 'Only the host can start the game.' });
                    return;
                }

                // Check start conditions (mode-aware)
                const check = this.teamCtrl.canStartGame();
                if (!check.ok) {
                    client.send('error', { message: check.reason });
                    return;
                }

                // Apply settings
                if (data?.settings) {
                    const s = this.state.settings;
                    if (data.settings.winMode) s.winMode = data.settings.winMode;
                    if (data.settings.targetScore) s.targetScore = data.settings.targetScore;
                    if (data.settings.totalRounds) s.totalRounds = data.settings.totalRounds;
                    if (data.settings.drawTime) s.drawTime = data.settings.drawTime;
                    if (data.settings.wordCategory) s.wordCategory = data.settings.wordCategory;
                }

                // Brief UI sync window then start
                setTimeout(() => {
                    this.roundCtrl.startGame();
                }, 500);
            }
        );

        // Select word (drawer only)
        this.onMessage(
            MSG.SELECT_WORD,
            (client, data: { wordIndex: number }) => {
                if (this.state.phase !== 'word-select') return;
                if (client.sessionId !== this.state.currentDrawer) return;
                this.roundCtrl.selectWord(data.wordIndex);
            }
        );

        // Draw stroke (drawer only)
        this.onMessage(MSG.DRAW, (client, data: IDrawStroke) => {
            if (this.state.phase !== 'drawing') return;
            if (client.sessionId !== this.state.currentDrawer) return;

            // Store stroke history
            this.strokeHistory.push(data);

            // Broadcast to all other clients
            this.broadcast('draw', data, { except: client });
        });

        // Clear canvas (drawer only, server-validated)
        this.onMessage(MSG.CLEAR_CANVAS, (client) => {
            if (this.state.phase !== 'drawing') return;
            if (client.sessionId !== this.state.currentDrawer) return;

            // Clear server-side stroke history
            this.strokeHistory = [];

            // Broadcast clear to all clients
            this.broadcast('clearCanvas');
        });

        // Undo (drawer only)
        this.onMessage(MSG.UNDO, (client) => {
            if (this.state.phase !== 'drawing') return;
            if (client.sessionId !== this.state.currentDrawer) return;

            // Remove last stroke from history
            if (this.strokeHistory.length > 0) {
                this.strokeHistory.pop();
            }

            // Broadcast undo to all clients
            this.broadcast('undo');
        });

        // Guess (role-aware)
        this.onMessage(MSG.GUESS, (client, data: { text: string }) => {
            if (this.state.phase !== 'drawing') return;
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const isFFA = this.state.settings.gameMode === 'ffa';

            if (isFFA) {
                // In FFA, any non-drawer can guess
                // In sudden death, only tied players (role = 'guesser') can guess
                if (player.sessionId === this.state.currentDrawer) return;
                if (this.state.isSuddenDeath && player.role !== 'guesser') {
                    client.send('error', { message: 'Only tied players can guess in sudden death!' });
                    return;
                }
            } else {
                // Teams mode: only guessers (drawer's teammates)
                if (player.role !== 'guesser') {
                    client.send('error', { message: 'Only teammates of the drawer can guess.' });
                    return;
                }
            }

            if (!data.text || data.text.trim().length === 0) return;

            this.roundCtrl.processGuess(
                client.sessionId,
                player.nickname,
                data.text
            );
        });

        // Chat (drawer, opponents, spectators — NOT guessers)
        this.onMessage(MSG.CHAT, (client, data: { text: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            // Guessers can't chat during drawing (they use guess input)
            if (player.role === 'guesser' && this.state.phase === 'drawing') {
                client.send('error', {
                    message: 'Use the guess input instead!',
                });
                return;
            }

            if (!data.text || data.text.trim().length === 0) return;

            const chatEntry = new ChatEntrySchema();
            chatEntry.playerId = client.sessionId;
            chatEntry.nickname = player.nickname;
            chatEntry.text = data.text.trim();
            chatEntry.timestamp = Date.now();
            this.state.chatMessages.push(chatEntry);

            // Keep chat history manageable
            if (this.state.chatMessages.length > 100) {
                this.state.chatMessages.splice(0, 50);
            }
        });

        // Play again (host only)
        this.onMessage(MSG.PLAY_AGAIN, (client) => {
            const player = this.state.players.get(client.sessionId);
            if (!player?.isHost) return;

            this.roundCtrl.reset();
            this.clearCanvas();

            // Reset shared state
            this.state.currentRound = 0;
            this.state.winningTeamIndex = -1;
            this.state.guesses.clear();
            this.state.chatMessages.clear();
            this.state.currentDrawer = '';
            this.state.wordHint = '';
            this.state.timeRemaining = 0;
            this.state.isSuddenDeath = false;
            this.state.winnerSessionIds.clear();

            // Reset mode-specific scores
            this.scoreCtrl.resetScores();
            this.scoreCtrl.resetPlayerScores();

            // Reset player roles and team assignments
            this.state.players.forEach((p) => {
                p.role = 'spectator';
                p.teamIndex = -1;
            });

            // Restore default teams for re-selection
            this.teamCtrl.initTeams(2);

            // Return to mode-select so host can pick again
            this.state.settings.gameMode = 'teams';
            this.state.phase = 'mode-select';
        });
    }

    // ─── Utilities ──────────────────────────────────────────

    public clearCanvas(): void {
        this.strokeHistory = [];
        this.broadcast('clearCanvas');
    }

    private generateRoomCode(): string {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
}
