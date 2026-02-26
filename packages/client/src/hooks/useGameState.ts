import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room } from 'colyseus.js';
import type {
    IPlayer,
    ITeam,
    IGameSettings,
    IGuessEntry,
    IChatEntry,
    GamePhase,
    IDrawStroke,
} from '@pulsing-supernova/shared';

interface GameStateHook {
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

const INITIAL_STATE: GameStateHook = {
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

/**
 * Extract plain JS state from the Colyseus room state schema.
 * Colyseus schema objects have .forEach etc. but we need to
 * convert them to plain JS types for React to diff properly.
 */
function extractState(room: Room): GameStateHook {
    const s = room.state as any;
    if (!s) return { ...INITIAL_STATE };

    const sessionId = room.sessionId;

    // Convert MapSchema to Map
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

    // Convert ArraySchema to array
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

/**
 * useGameState — subscribes to Colyseus room state and provides
 * reactive game state values for React components.
 */
export function useGameState(room: Room | null) {
    const [state, setState] = useState<GameStateHook>({ ...INITIAL_STATE });

    // Use refs for canvas callbacks to avoid re-running the effect
    const onDrawRef = useRef<((stroke: IDrawStroke) => void) | null>(null);
    const onClearRef = useRef<(() => void) | null>(null);
    const onUndoRef = useRef<(() => void) | null>(null);
    const onStrokeHistoryRef = useRef<
        ((strokes: IDrawStroke[]) => void) | null
    >(null);

    useEffect(() => {
        if (!room) {
            setState({ ...INITIAL_STATE });
            return;
        }

        let cancelled = false;

        // Helper to update state from room, preserving direct-message fields
        const syncState = () => {
            if (cancelled) return;
            const newState = extractState(room);
            setState((prev) => ({
                ...newState,
                wordChoices: prev.wordChoices,
                secretWord: prev.secretWord,
            }));
        };

        // Listen for state changes from Colyseus (fires on SUBSEQUENT mutations)
        room.onStateChange(() => {
            syncState();
        });

        // Listen for direct messages
        room.onMessage('wordChoices', (data: { words: string[] }) => {
            setState((prev) => ({ ...prev, wordChoices: data.words }));
        });

        room.onMessage('secretWord', (data: { word: string }) => {
            setState((prev) => ({ ...prev, secretWord: data.word }));
        });

        room.onMessage('draw', (stroke: IDrawStroke) => {
            onDrawRef.current?.(stroke);
        });

        room.onMessage('clearCanvas', () => {
            onClearRef.current?.();
        });

        room.onMessage('undo', () => {
            onUndoRef.current?.();
        });

        room.onMessage('strokeHistory', (strokes: IDrawStroke[]) => {
            onStrokeHistoryRef.current?.(strokes);
        });

        room.onMessage('error', (data: { message: string }) => {
            console.error('Server error:', data.message);
        });

        // Robust initial state reading: onStateChange does NOT fire for the
        // initial sync. Poll at short intervals until valid state is detected,
        // then stop. This handles varying decode times.
        const pollDelays = [0, 50, 200, 500, 1000];
        const pollTimers: ReturnType<typeof setTimeout>[] = [];
        let initialSynced = false;

        for (const delay of pollDelays) {
            const timer = setTimeout(() => {
                if (cancelled || initialSynced) return;
                const s = extractState(room);
                if (s.roomCode || s.players.size > 0 || s.teams.length > 0) {
                    initialSynced = true;
                }
                syncState();
            }, delay);
            pollTimers.push(timer);
        }

        return () => {
            cancelled = true;
            pollTimers.forEach(clearTimeout);
        };
    }, [room]); // Only re-run when room changes

    // Register canvas callbacks via refs (no effect re-run needed)
    const registerCanvasCallbacks = useCallback(
        (callbacks: {
            onDraw: (stroke: IDrawStroke) => void;
            onClear: () => void;
            onUndo: () => void;
            onStrokeHistory: (strokes: IDrawStroke[]) => void;
        }) => {
            onDrawRef.current = callbacks.onDraw;
            onClearRef.current = callbacks.onClear;
            onUndoRef.current = callbacks.onUndo;
            onStrokeHistoryRef.current = callbacks.onStrokeHistory;
        },
        []
    );

    return {
        ...state,
        registerCanvasCallbacks,
    };
}
