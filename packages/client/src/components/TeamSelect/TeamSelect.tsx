import React from 'react';
import type { ITeam, IPlayer } from '@pulsing-supernova/shared';
import type { Room } from 'colyseus.js';
import { MSG, WORD_CATEGORIES } from '@pulsing-supernova/shared';
import type { GameMode } from '@pulsing-supernova/shared';

interface TeamSelectProps {
    room: Room;
    roomCode: string;
    teams: ITeam[];
    players: Map<string, IPlayer>;
    myPlayer: IPlayer | null;
    gameMode?: GameMode;
}

export function TeamSelect({ room, roomCode, teams, players, myPlayer, gameMode = 'teams' }: TeamSelectProps) {
    const handleJoinTeam = (teamIndex: number) => {
        room.send(MSG.JOIN_TEAM, { teamIndex });
    };

    const handleSpectate = () => {
        room.send(MSG.SPECTATE);
    };

    const handleStartGame = () => {
        room.send(MSG.START_GAME, {});
    };

    // ─── FFA lobby ──────────────────────────────────────────────────
    if (gameMode === 'ffa') {
        const connectedPlayers = Array.from(players.values()).filter(p => p.isConnected);
        return (
            <div className="lobby-screen">
                <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                        🎯 Free For All
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Room Code: <strong style={{ letterSpacing: '3px', fontSize: 'var(--font-xl)' }}>{roomCode}</strong>
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-xs)' }}>
                        Everyone draws and guesses — no teams needed!
                    </p>
                </div>

                <div className="glass-card animate-slide-up" style={{ minWidth: '320px', maxWidth: '480px', width: '100%' }}>
                    <div className="team-card-header">
                        <span className="team-name" style={{ color: 'var(--color-primary)' }}>Players</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{connectedPlayers.length} joined</span>
                    </div>
                    <div className="team-players" style={{ marginBottom: 'var(--space-lg)', minHeight: '80px' }}>
                        {connectedPlayers.map((p) => (
                            <div key={p.sessionId} className="player-row">
                                <div className="player-avatar" style={{ background: p.avatarColor }} />
                                <span className="player-name">{p.nickname}</span>
                                {p.isHost && <span className="badge badge-host">👑 Host</span>}
                                {p.sessionId === myPlayer?.sessionId && <span className="badge" style={{ background: 'var(--color-success)', color: '#000' }}>You</span>}
                            </div>
                        ))}
                        {connectedPlayers.length < 2 && (
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', fontStyle: 'italic' }}>
                                Waiting for more players... (need at least 2)
                            </p>
                        )}
                    </div>
                </div>

                {myPlayer?.isHost && (
                    <button
                        className="btn btn-success btn-lg"
                        onClick={handleStartGame}
                        disabled={connectedPlayers.length < 2}
                        id="btn-start-game-ffa"
                    >
                        🚀 Start FFA Game
                    </button>
                )}
                {!myPlayer?.isHost && (
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
                        Waiting for the host to start the game...
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="lobby-screen">
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                    Choose Your Team
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Room Code: <strong style={{ letterSpacing: '3px', fontSize: 'var(--font-xl)' }}>{roomCode}</strong>
                </p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', justifyContent: 'center' }}>
                {teams.map((team, idx) => {
                    const teamPlayers = Array.from(players.values()).filter(
                        (p) => p.teamIndex === idx
                    );
                    const isMyTeam = myPlayer?.teamIndex === idx;

                    return (
                        <div
                            key={idx}
                            className="glass-card animate-slide-up"
                            style={{
                                minWidth: '280px',
                                borderColor: isMyTeam ? team.color : undefined,
                                borderWidth: isMyTeam ? '2px' : undefined,
                                animationDelay: `${idx * 0.1}s`,
                            }}
                        >
                            <div className="team-card-header">
                                <span className="team-name" style={{ color: team.color }}>
                                    {team.name}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                    {teamPlayers.length} players
                                </span>
                            </div>

                            <div className="team-players" style={{ marginBottom: 'var(--space-lg)', minHeight: '80px' }}>
                                {teamPlayers.map((p) => (
                                    <div key={p.sessionId} className="player-row">
                                        <div
                                            className="player-avatar"
                                            style={{ background: p.avatarColor }}
                                        />
                                        <span className="player-name">{p.nickname}</span>
                                        {p.isHost && <span className="badge badge-host">Host</span>}
                                    </div>
                                ))}
                                {teamPlayers.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', fontStyle: 'italic' }}>
                                        No players yet
                                    </p>
                                )}
                            </div>

                            <button
                                className={`btn ${isMyTeam ? 'btn-secondary' : 'btn-primary'} btn-lg`}
                                style={{ width: '100%', background: isMyTeam ? undefined : team.color }}
                                onClick={() => handleJoinTeam(idx)}
                                disabled={isMyTeam}
                            >
                                {isMyTeam ? '✓ Joined' : `Join ${team.name}`}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={handleSpectate}>
                    👀 Spectate
                </button>

                {myPlayer?.isHost && (
                    <button className="btn btn-success btn-lg" onClick={handleStartGame}>
                        🚀 Start Game
                    </button>
                )}
            </div>
        </div>
    );
}
