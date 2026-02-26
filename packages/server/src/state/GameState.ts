import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import type { GamePhase, PlayerRole, WinMode } from '@pulsing-supernova/shared';

// ═══════════════════════════════════════════════════════════
// Colyseus Schema — auto-synced to all clients
// ═══════════════════════════════════════════════════════════

export class PlayerSchema extends Schema {
    @type('string') sessionId: string = '';
    @type('string') nickname: string = '';
    @type('string') avatarColor: string = '';
    @type('int8') teamIndex: number = -1;
    @type('string') role: PlayerRole = 'spectator';
    @type('boolean') isHost: boolean = false;
    @type('boolean') isConnected: boolean = true;
}

export class TeamSchema extends Schema {
    @type('string') name: string = '';
    @type('string') color: string = '';
    @type('int32') score: number = 0;
    @type(['string']) drawerQueue = new ArraySchema<string>();
}

export class GameSettingsSchema extends Schema {
    @type('string') winMode: WinMode = 'points';
    @type('int32') targetScore: number = 10;
    @type('int32') totalRounds: number = 10;
    @type('int32') drawTime: number = 75;
    @type('string') wordCategory: string = 'mixed';
}

export class GuessEntrySchema extends Schema {
    @type('string') playerId: string = '';
    @type('string') nickname: string = '';
    @type('string') text: string = '';
    @type('boolean') isCorrect: boolean = false;
    @type('int64') timestamp: number = 0;
}

export class ChatEntrySchema extends Schema {
    @type('string') playerId: string = '';
    @type('string') nickname: string = '';
    @type('string') text: string = '';
    @type('int64') timestamp: number = 0;
}

export class GameState extends Schema {
    @type('string') roomCode: string = '';
    @type('string') phase: GamePhase = 'lobby';
    @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
    @type([TeamSchema]) teams = new ArraySchema<TeamSchema>();
    @type('int32') currentRound: number = 0;
    @type(GameSettingsSchema) settings = new GameSettingsSchema();
    @type('string') currentDrawer: string = '';
    @type('string') wordHint: string = '';
    @type('int32') timeRemaining: number = 0;
    @type('int8') activeTeamIndex: number = 0;
    @type([GuessEntrySchema]) guesses = new ArraySchema<GuessEntrySchema>();
    @type([ChatEntrySchema]) chatMessages = new ArraySchema<ChatEntrySchema>();
    @type('int8') winningTeamIndex: number = -1;
}
