// ═══════════════════════════════════════════════════════════
// Game State Types — shared between server and client
// ═══════════════════════════════════════════════════════════

/** All possible game phases */
export type GamePhase =
    | 'lobby'
    | 'team-select'
    | 'word-select'
    | 'drawing'
    | 'round-end'
    | 'game-over';

/** Player roles assigned each round by the server */
export type PlayerRole = 'drawer' | 'guesser' | 'opponent' | 'spectator';

/** Drawing tool types */
export type DrawTool = 'pen' | 'eraser';

/** Win condition mode */
export type WinMode = 'points' | 'rounds';

// ─── Player ───────────────────────────────────────────────

export interface IPlayer {
    sessionId: string;
    nickname: string;
    avatarColor: string;
    teamIndex: number;        // -1 = spectator / unassigned
    role: PlayerRole;
    isHost: boolean;
    isConnected: boolean;
}

// ─── Team ─────────────────────────────────────────────────

export interface ITeam {
    name: string;
    color: string;
    score: number;
    drawerQueue: string[];    // session IDs in rotation order
}

// ─── Game Settings ────────────────────────────────────────

export interface IGameSettings {
    winMode: WinMode;
    targetScore: number;      // default 10
    totalRounds: number;      // default 10
    drawTime: number;         // seconds, default 75
    wordCategory: string;     // 'mixed' | category key
}

// ─── Drawing ──────────────────────────────────────────────

export interface IDrawStroke {
    points: [number, number][];   // normalized 0–1 coords
    color: string;
    width: number;
    tool: DrawTool;
}

// ─── Guess / Chat ─────────────────────────────────────────

export interface IGuessEntry {
    playerId: string;
    nickname: string;
    text: string;
    isCorrect: boolean;
    timestamp: number;
}

export interface IChatEntry {
    playerId: string;
    nickname: string;
    text: string;
    timestamp: number;
}

// ─── Full Game State ──────────────────────────────────────

export interface IGameState {
    roomCode: string;
    phase: GamePhase;
    players: Map<string, IPlayer>;
    teams: ITeam[];
    currentRound: number;
    settings: IGameSettings;
    currentDrawer: string | null;
    currentWord: string | null;     // only visible to drawer
    wordHint: string;               // "_ _ _ _ _" progressive
    wordChoices: string[];           // 3 choices (only sent to drawer)
    timeRemaining: number;
    activeTeamIndex: number;         // which team is drawing
    guesses: IGuessEntry[];
    chatMessages: IChatEntry[];
    winningTeamIndex: number;        // -1 until game over
}
