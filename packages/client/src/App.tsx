import React, { useRef, useCallback, useEffect } from 'react';
import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby/Lobby';
import { ModeSelect } from './components/ModeSelect/ModeSelect';
import { TeamSelect } from './components/TeamSelect/TeamSelect';
import { DrawingCanvas, type DrawingCanvasHandle } from './components/DrawingCanvas/DrawingCanvas';
import { GuessingPanel } from './components/GuessingPanel/GuessingPanel';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { GameOver } from './components/GameOver/GameOver';
import { MSG } from '@pulsing-supernova/shared';
import type { IDrawStroke } from '@pulsing-supernova/shared';

export default function App() {
    const game = useGame();
    const canvasRef = useRef<DrawingCanvasHandle>(null);
    const pendingStrokesRef = useRef<IDrawStroke[] | null>(null);

    // Register canvas callbacks for receiving remote strokes
    const handleRemoteStroke = useCallback((stroke: IDrawStroke) => {
        canvasRef.current?.drawStroke(stroke);
    }, []);

    const handleRemoteClear = useCallback(() => {
        canvasRef.current?.clearCanvas();
    }, []);

    const handleRemoteUndo = useCallback(() => {
        canvasRef.current?.undoStroke();
    }, []);

    const handleStrokeHistory = useCallback((strokes: IDrawStroke[]) => {
        if (canvasRef.current) {
            canvasRef.current.replayStrokes(strokes);
        } else {
            // Buffer strokes if canvas is not mounted yet
            pendingStrokesRef.current = strokes;
        }
    }, []);

    // Register canvas callbacks with context
    useEffect(() => {
        if (game.room) {
            game.registerCanvasCallbacks({
                onDraw: handleRemoteStroke,
                onClear: handleRemoteClear,
                onUndo: handleRemoteUndo,
                onStrokeHistory: handleStrokeHistory,
            });
        }
    }, [game.room, game.registerCanvasCallbacks, handleRemoteStroke, handleRemoteClear, handleRemoteUndo, handleStrokeHistory]);

    // Flush pending strokes when entering drawing phase
    useEffect(() => {
        if (game.phase === 'drawing' && pendingStrokesRef.current && canvasRef.current) {
            canvasRef.current.replayStrokes(pendingStrokesRef.current);
            pendingStrokesRef.current = null;
        }
    }, [game.phase, canvasRef]);

    // Drawing phase handlers
    const handleLocalStroke = useCallback((stroke: IDrawStroke) => {
        game.room?.send(MSG.DRAW, stroke);
    }, [game.room]);

    const handleLocalClear = useCallback(() => {
        game.room?.send(MSG.CLEAR_CANVAS);
    }, [game.room]);

    const handleLocalUndo = useCallback(() => {
        game.room?.send(MSG.UNDO);
    }, [game.room]);

    // ─── Phase-based rendering ─────────────────────────

    // Not connected — show lobby
    if (!game.room) {
        return (
            <Lobby
                onCreateRoom={game.createRoom}
                onJoinRoom={game.joinRoom}
                error={game.error}
                isConnecting={game.isConnecting}
            />
        );
    }

    // Mode selection screen
    if (game.phase === 'mode-select') {
        return (
            <ModeSelect
                room={game.room}
                roomCode={game.roomCode}
                myPlayer={game.myPlayer}
                playerCount={game.players.size}
            />
        );
    }

    // Team select (also used for lobby phase when in teams mode)
    if (!game.phase || game.phase === 'lobby' || game.phase === 'team-select') {
        return (
            <TeamSelect
                room={game.room}
                roomCode={game.roomCode}
                teams={game.teams}
                players={game.players}
                myPlayer={game.myPlayer}
                gameMode={game.gameMode}
            />
        );
    }

    // Game Over
    if (game.phase === 'game-over') {
        return (
            <GameOver
                room={game.room}
                teams={game.teams}
                winningTeamIndex={game.winningTeamIndex}
                myPlayer={game.myPlayer}
                gameMode={game.gameMode}
                players={game.players}
                playerScores={game.playerScores}
                winnerSessionIds={game.winnerSessionIds}
            />
        );
    }

    // Word selection
    if (game.phase === 'word-select') {
        const isDrawer = game.myRole === 'drawer';
        const drawerPlayer = game.players.get(game.currentDrawer);
        const isFFA = game.gameMode === 'ffa';

        return (
            <div className="game-layout">
                <div className="game-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <span
                            className="room-code-badge"
                            title="Click to copy room code"
                            onClick={() => navigator.clipboard.writeText(game.roomCode)}
                        >
                            🔑 {game.roomCode}
                        </span>
                        <span style={{ fontWeight: 600 }}>Round {game.currentRound}</span>
                        {!isFFA && (
                            <>
                                <span style={{ color: 'var(--text-muted)' }}>•</span>
                                <span style={{ color: game.teams[game.activeTeamIndex]?.color }}>
                                    {game.teams[game.activeTeamIndex]?.name}
                                </span>
                            </>
                        )}
                        {game.isSuddenDeath && (
                            <span className="badge badge-sudden-death animate-pulse">⚡ SUDDEN DEATH</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div className="badge badge-drawer">
                            ✏️ Drawer: {drawerPlayer?.nickname || '...'}
                        </div>
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.75rem', fontSize: 'var(--font-sm)' }}
                            onClick={() => {
                                game.leaveRoom();
                            }}
                        >
                            Exit
                        </button>
                    </div>
                </div>

                <Scoreboard
                    teams={game.teams}
                    players={game.players}
                    activeTeamIndex={game.activeTeamIndex}
                    currentDrawer={game.currentDrawer}
                    gameMode={game.gameMode}
                    playerScores={game.playerScores}
                />

                <div className="flex-center" style={{ gridColumn: '2 / -1' }}>
                    {isDrawer ? (
                        <div className="word-choice-screen animate-scale-in">
                            <h2 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>
                                {game.isSuddenDeath ? '⚡ Sudden Death — Choose a word!' : 'Choose a word to draw'}
                            </h2>
                            <div className="word-choices">
                                {game.wordChoices.map((word, idx) => (
                                    <button
                                        key={idx}
                                        className="word-card"
                                        onClick={() => game.room!.send(MSG.SELECT_WORD, { wordIndex: idx })}
                                    >
                                        {word}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-pulse" style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 600 }}>
                                ✏️ {drawerPlayer?.nickname} is choosing a word...
                            </p>
                            {game.isSuddenDeath && (
                                <p style={{ color: 'var(--color-warning)', fontWeight: 700, marginTop: 'var(--space-sm)' }}>
                                    ⚡ Sudden Death! First to guess wins the game!
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Drawing Phase (main game) ─────────────────────

    const isDrawer = game.myRole === 'drawer';
    const drawerPlayer = game.players.get(game.currentDrawer);
    const isFFA = game.gameMode === 'ffa';
    const myTeam = game.myPlayer
        ? game.teams[game.myPlayer.teamIndex]
        : null;

    const timerClass =
        game.timeRemaining <= 10
            ? 'danger'
            : game.timeRemaining <= 30
                ? 'warning'
                : '';

    return (
        <div className="game-layout">
            {/* Header */}
            <div className="game-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <span
                        className="room-code-badge"
                        title="Click to copy room code"
                        onClick={() => navigator.clipboard.writeText(game.roomCode)}
                    >
                        🔑 {game.roomCode}
                    </span>
                    <span style={{ fontWeight: 600 }}>Round {game.currentRound}</span>
                    {!isFFA && (
                        <>
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            <span style={{ color: game.teams[game.activeTeamIndex]?.color, fontWeight: 600 }}>
                                {game.teams[game.activeTeamIndex]?.name}
                            </span>
                        </>
                    )}
                    <span className="badge badge-drawer">
                        ✏️ {drawerPlayer?.nickname || 'Drawer'}
                    </span>
                    {game.isSuddenDeath && (
                        <span className="badge badge-sudden-death animate-pulse">⚡ SUDDEN DEATH</span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                    <div className="word-hint">
                        {isDrawer ? game.secretWord : game.wordHint}
                    </div>
                    <div className={`timer ${timerClass}`}>
                        ⏱️ {game.timeRemaining}s
                    </div>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: 'var(--font-sm)' }}
                        onClick={() => {
                            game.leaveRoom();
                        }}
                    >
                        Exit
                    </button>
                </div>
            </div>

            {/* Left sidebar — Scoreboard */}
            <Scoreboard
                teams={game.teams}
                players={game.players}
                activeTeamIndex={game.activeTeamIndex}
                currentDrawer={game.currentDrawer}
                gameMode={game.gameMode}
                playerScores={game.playerScores}
            />

            {/* Center — Canvas */}
            <DrawingCanvas
                ref={canvasRef}
                isDrawer={isDrawer}
                onStroke={handleLocalStroke}
                onClear={handleLocalClear}
                onUndo={handleLocalUndo}
            />

            {/* Right sidebar — Guessing/Chat */}
            <div className="game-sidebar-right">
                <GuessingPanel
                    room={game.room}
                    role={game.myRole as any}
                    guesses={game.guesses}
                    chatMessages={game.chatMessages}
                    teamName={isFFA ? undefined : myTeam?.name}
                    isFFA={isFFA}
                    isSuddenDeath={game.isSuddenDeath}
                    winnerSessionIds={game.winnerSessionIds}
                    mySessionId={game.myPlayer?.sessionId}
                />
            </div>
        </div>
    );
}
