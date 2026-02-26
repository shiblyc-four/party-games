import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Client, Room } from 'colyseus.js';
import type {
    IPlayer,
    ITeam,
    IGameSettings,
    IGuessEntry,
    IChatEntry,
    GamePhase,
    IDrawStroke,
} from '@pulsing-supernova/shared';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface GameState {
    phase: GamePhase;
    roomCode: string;
    players: Map<string, IPlayer>;
    teams: ITeam[];
    currentRound: number;
    settings: IGameSettings;
    currentDrawer: string;
    wordHint: string;
    timeRemaining: number;
    activeTeamIndex: number;
    guesses: IGuessEntry[];
    chatMessages: IChatEntry[];
    winningTeamIndex: number;
    myPlayer: IPlayer | null;
    myRole: string;
    wordChoices: string[];
    secretWord: string;
}

interface GameContextValue extends GameState {
    room: Room | null;
    error: string | null;
    isConnecting: boolean;
    createRoom: (nickname: string) => Promise<void>;
    joinRoom: (roomCode: string, nickname: string) => Promise<void>;
    leaveRoom: () => void;
    registerCanvasCallbacks: (callbacks: CanvasCallbacks) => void;
}

interface CanvasCallbacks {
    onDraw: (stroke: IDrawStroke) => void;
    onClear: () => void;
    onUndo: () => void;
    onStrokeHistory: (strokes: IDrawStroke[]) => void;
}

// ═══════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════

const INITIAL_GAME_STATE: GameState = {
    phase: 'lobby',
    roomCode: '',
    players: new Map(),
    teams: [],
    currentRound: 0,
    settings: {
        winMode: 'points',
        targetScore: 10,
        totalRounds: 10,
        drawTime: 75,
        wordCategory: 'mixed',
    },
    currentDrawer: '',
    wordHint: '',
    timeRemaining: 0,
    activeTeamIndex: 0,
    guesses: [],
    chatMessages: [],
    winningTeamIndex: -1,
    myPlayer: null,
    myRole: 'spectator',
    wordChoices: [],
    secretWord: '',
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3001';

// ═══════════════════════════════════════════════════════════
// State Extraction — converts Colyseus Schema → plain JS
// ═══════════════════════════════════════════════════════════

function extractState(room: Room): GameState {
    const s = room.state as any;
    if (!s) return { ...INITIAL_GAME_STATE };

    const sessionId = room.sessionId;

    // MapSchema → Map
    const players = new Map<string, IPlayer>();
    if (s.players) {
        s.players.forEach((p: any, key: string) => {
            players.set(key, {
                sessionId: p.sessionId,
                nickname: p.nickname,
                avatarColor: p.avatarColor,
                teamIndex: p.teamIndex,
                role: p.role,
                isHost: p.isHost,
                isConnected: p.isConnected,
            });
        });
    }

    // ArraySchema → array
    const teams: ITeam[] = [];
    if (s.teams) {
        s.teams.forEach((t: any) => {
            const drawerQueue: string[] = [];
            if (t.drawerQueue) {
                t.drawerQueue.forEach((id: string) => drawerQueue.push(id));
            }
            teams.push({
                name: t.name,
                color: t.color,
                score: t.score,
                drawerQueue,
            });
        });
    }

    const guesses: IGuessEntry[] = [];
    if (s.guesses) {
        s.guesses.forEach((g: any) => {
            guesses.push({
                playerId: g.playerId,
                nickname: g.nickname,
                text: g.text,
                isCorrect: g.isCorrect,
                timestamp: g.timestamp,
            });
        });
    }

    const chatMessages: IChatEntry[] = [];
    if (s.chatMessages) {
        s.chatMessages.forEach((c: any) => {
            chatMessages.push({
                playerId: c.playerId,
                nickname: c.nickname,
                text: c.text,
                timestamp: c.timestamp,
            });
        });
    }

    const myPlayer = players.get(sessionId) || null;

    return {
        phase: s.phase || 'lobby',
        roomCode: s.roomCode || '',
        players,
        teams,
        currentRound: s.currentRound || 0,
        settings: {
            winMode: s.settings?.winMode || 'points',
            targetScore: s.settings?.targetScore || 10,
            totalRounds: s.settings?.totalRounds || 10,
            drawTime: s.settings?.drawTime || 75,
            wordCategory: s.settings?.wordCategory || 'mixed',
        },
        currentDrawer: s.currentDrawer || '',
        wordHint: s.wordHint || '',
        timeRemaining: s.timeRemaining || 0,
        activeTeamIndex: s.activeTeamIndex || 0,
        guesses,
        chatMessages,
        winningTeamIndex: s.winningTeamIndex ?? -1,
        myPlayer,
        myRole: myPlayer?.role || 'spectator',
        wordChoices: [],
        secretWord: '',
    };
}

// ═══════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error('useGame must be used within <GameProvider>');
    return ctx;
}

// ═══════════════════════════════════════════════════════════
// Provider — all room + game state lives here, ONCE
// ═══════════════════════════════════════════════════════════

export function GameProvider({ children }: { children: React.ReactNode }) {
    // ── Stable refs (survive re-renders + StrictMode) ──────
    const clientRef = useRef<Client>(new Client(SERVER_URL));
    const roomRef = useRef<Room | null>(null);
    const canvasRef = useRef<CanvasCallbacks | null>(null);

    // ── React state (triggers re-renders) ──────────────────
    const [room, setRoom] = useState<Room | null>(null);
    const [gameState, setGameState] = useState<GameState>({ ...INITIAL_GAME_STATE });
    const [error, setError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // ── Sync helper ────────────────────────────────────────
    const syncState = useCallback(() => {
        const r = roomRef.current;
        if (!r) return;
        const newState = extractState(r);
        setGameState((prev) => ({
            ...newState,
            // Preserve direct-message fields
            wordChoices: prev.wordChoices,
            secretWord: prev.secretWord,
        }));
    }, []);

    // ── Wire up all Colyseus listeners on a room ──────────
    const wireRoom = useCallback((r: Room) => {
        // State changes (fires on SUBSEQUENT mutations)
        r.onStateChange(() => {
            syncState();
        });

        // Direct messages
        r.onMessage('wordChoices', (data: { words: string[] }) => {
            setGameState((prev) => ({ ...prev, wordChoices: data.words }));
        });
        r.onMessage('secretWord', (data: { word: string }) => {
            setGameState((prev) => ({ ...prev, secretWord: data.word }));
        });
        r.onMessage('draw', (stroke: IDrawStroke) => {
            canvasRef.current?.onDraw(stroke);
        });
        r.onMessage('clearCanvas', () => {
            canvasRef.current?.onClear();
        });
        r.onMessage('undo', () => {
            canvasRef.current?.onUndo();
        });
        r.onMessage('strokeHistory', (strokes: IDrawStroke[]) => {
            canvasRef.current?.onStrokeHistory(strokes);
        });
        r.onMessage('error', (data: { message: string }) => {
            console.error('Server error:', data.message);
        });

        // Disconnect handling
        r.onLeave((code: number) => {
            roomRef.current = null;
            setRoom(null);
            setGameState({ ...INITIAL_GAME_STATE });
            if (code >= 4000) setError('Disconnected from room');
        });

        r.onError((code: number, message?: string) => {
            console.error(`Room error ${code}: ${message}`);
            setError(message || `Error code: ${code}`);
        });

        // ── Initial state read ─────────────────────────────
        // onStateChange does NOT fire for the initial sync.
        // Poll at short intervals until valid state is detected.
        const pollDelays = [0, 50, 150, 400, 800, 1500, 3000];
        let done = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        for (const delay of pollDelays) {
            timers.push(setTimeout(() => {
                if (done) return;
                const s = extractState(r);
                if (s.roomCode || s.players.size > 0 || s.teams.length > 0) {
                    done = true;
                }
                setGameState((prev) => ({
                    ...s,
                    wordChoices: prev.wordChoices,
                    secretWord: prev.secretWord,
                }));
            }, delay));
        }
    }, [syncState]);

    // ── Actions ────────────────────────────────────────────

    const createRoom = useCallback(async (nickname: string) => {
        setIsConnecting(true);
        setError(null);
        try {
            const r = await clientRef.current.create('pictionary', { nickname });
            roomRef.current = r;
            setRoom(r);
            wireRoom(r);
        } catch (err: any) {
            console.error('Failed to create room:', err);
            setError(err.message || 'Failed to create room');
        } finally {
            setIsConnecting(false);
        }
    }, [wireRoom]);

    const joinRoom = useCallback(async (roomCode: string, nickname: string) => {
        setIsConnecting(true);
        setError(null);
        try {
            // Look up rooms by custom code in metadata
            const rooms = await clientRef.current.getAvailableRooms('pictionary');
            const target = rooms.find(
                (r) => r.metadata?.roomCode?.toUpperCase() === roomCode.toUpperCase()
            );
            if (!target) {
                setError(`Room "${roomCode}" not found. Check the code and try again.`);
                setIsConnecting(false);
                return;
            }
            const r = await clientRef.current.joinById(target.roomId, { nickname });
            roomRef.current = r;
            setRoom(r);
            wireRoom(r);
        } catch (err: any) {
            console.error('Failed to join room:', err);
            setError(err.message || 'Failed to join room');
        } finally {
            setIsConnecting(false);
        }
    }, [wireRoom]);

    const leaveRoom = useCallback(() => {
        roomRef.current?.leave();
        roomRef.current = null;
        setRoom(null);
        setGameState({ ...INITIAL_GAME_STATE });
        setError(null);
    }, []);

    const registerCanvasCallbacks = useCallback((callbacks: CanvasCallbacks) => {
        canvasRef.current = callbacks;
    }, []);

    // ── Context value ──────────────────────────────────────

    const value: GameContextValue = {
        room,
        error,
        isConnecting,
        createRoom,
        joinRoom,
        leaveRoom,
        registerCanvasCallbacks,
        ...gameState,
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
}
