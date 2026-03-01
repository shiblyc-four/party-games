import type { IGameSettings } from './types.js';

// ═══════════════════════════════════════════════════════════
// Game Constants
// ═══════════════════════════════════════════════════════════

/** Default game settings */
export const DEFAULT_SETTINGS: IGameSettings = {
    winMode: 'points',
    targetScore: 10,
    totalRounds: 10,
    drawTime: 75,
    wordCategory: 'mixed',
    gameMode: 'teams',
};

/** Timing constants (in seconds) */
export const TIMING = {
    WORD_CHOICE_TIME: 15,   // seconds for drawer to pick a word
    MIN_DRAW_TIME: 30,
    MAX_DRAW_TIME: 120,
    ROUND_END_DELAY: 5,     // pause between rounds
    HINT_INTERVAL: 20,      // reveal a letter every N seconds
} as const;

/** Team presets */
export const TEAM_PRESETS = [
    { name: 'Team Blaze', color: '#FF6B35' },
    { name: 'Team Wave', color: '#4ECDC4' },
    { name: 'Team Volt', color: '#FFE66D' },
] as const;

/** Avatar color palette for players */
export const AVATAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
] as const;

/** Drawing tool defaults */
export const DRAWING_DEFAULTS = {
    PEN_COLOR: '#FFFFFF',
    PEN_WIDTH: 3,
    ERASER_WIDTH: 20,
    CANVAS_BG: '#1a1a2e',
    BRUSH_SIZES: [2, 4, 8, 12, 20],
    COLORS: [
        '#FFFFFF', '#C0C0C0', '#808080', '#000000',
        '#FF0000', '#FF6B35', '#FFD700', '#00FF00',
        '#00BFFF', '#4169E1', '#8B00FF', '#FF69B4',
        '#8B4513', '#228B22', '#FF4500', '#1E90FF',
    ],
} as const;

// ═══════════════════════════════════════════════════════════
// Client → Server Message Types
// ═══════════════════════════════════════════════════════════

export const MSG = {
    // Lobby / mode select
    SET_GAME_MODE: 'setGameMode',

    // Lobby / team select
    JOIN_TEAM: 'joinTeam',
    SPECTATE: 'spectate',
    START_GAME: 'startGame',

    // Drawing phase
    SELECT_WORD: 'selectWord',
    DRAW: 'draw',
    CLEAR_CANVAS: 'clearCanvas',
    UNDO: 'undo',

    // Guessing / chat
    GUESS: 'guess',
    CHAT: 'chat',

    // Game flow
    PLAY_AGAIN: 'playAgain',
} as const;

// ═══════════════════════════════════════════════════════════
// Server → Client Message Types (direct messages, not state)
// ═══════════════════════════════════════════════════════════

export const SERVER_MSG = {
    WORD_CHOICES: 'wordChoices',        // sent only to drawer
    CORRECT_GUESS: 'correctGuess',      // broadcast celebration
    ROUND_RESULT: 'roundResult',        // round summary
    ERROR: 'error',                     // validation error
} as const;
