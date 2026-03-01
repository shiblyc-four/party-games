import React from 'react';
import type { ITeam, IPlayer } from '@pulsing-supernova/shared';
import type { GameMode } from '@pulsing-supernova/shared';

interface ScoreboardProps {
    teams: ITeam[];
    players: Map<string, IPlayer>;
    activeTeamIndex: number;
    currentDrawer: string;
    gameMode?: GameMode;
    playerScores?: Map<string, number>;
}

export function Scoreboard({
    teams,
    players,
    activeTeamIndex,
    currentDrawer,
    gameMode = 'teams',
    playerScores = new Map(),
}: ScoreboardProps) {
    // ─── FFA leaderboard ────────────────────────────────────────
    if (gameMode === 'ffa') {
        const playerList = Array.from(players.values())
            .filter(p => p.teamIndex >= 0 || p.sessionId === currentDrawer)
            .sort((a, b) => {
                const sa = playerScores.get(a.sessionId) ?? 0;
                const sb = playerScores.get(b.sessionId) ?? 0;
                return sb - sa; // descending
            });

        return (
            <div className="game-sidebar-left">
                <div className="ffa-leaderboard-header">🏅 Leaderboard</div>
                {playerList.map((p) => {
                    const score = playerScores.get(p.sessionId) ?? 0;
                    const isDrawing = p.sessionId === currentDrawer;
                    return (
                        <div
                            key={p.sessionId}
                            className="ffa-player-row"
                            style={{ borderColor: isDrawing ? p.avatarColor : undefined }}
                        >
                            <div className="player-avatar" style={{ background: p.avatarColor }} />
                            <div className="ffa-player-info">
                                <span className="player-name" style={{ fontSize: 'var(--font-sm)' }}>
                                    {p.nickname}
                                    {p.isHost && <span className="badge badge-host" style={{ marginLeft: 4 }}>👑</span>}
                                </span>
                                {isDrawing && <span className="badge badge-drawer" style={{ fontSize: '10px' }}>✏️ Drawing</span>}
                            </div>
                            <span className="ffa-player-score" style={{ color: isDrawing ? p.avatarColor : 'var(--text-primary)' }}>
                                {score}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return (
        <div className="game-sidebar-left">
            {teams.map((team, idx) => {
                const teamPlayers = Array.from(players.values()).filter(
                    (p) => p.teamIndex === idx
                );
                const isActive = idx === activeTeamIndex;

                return (
                    <div
                        key={idx}
                        className="team-card"
                        style={{
                            borderColor: isActive ? team.color : undefined,
                            borderWidth: isActive ? '2px' : undefined,
                            boxShadow: isActive
                                ? `0 0 20px ${team.color}33`
                                : undefined,
                        }}
                    >
                        <div className="team-card-header">
                            <span className="team-name" style={{ color: team.color }}>
                                {team.name}
                                {isActive && (
                                    <span style={{ fontSize: 'var(--font-sm)', marginLeft: 'var(--space-sm)', opacity: 0.7 }}>
                                        ← Active
                                    </span>
                                )}
                            </span>
                            <span className="team-score" style={{ color: team.color }}>
                                {team.score}
                            </span>
                        </div>

                        <div className="team-players">
                            {teamPlayers.map((p) => (
                                <div key={p.sessionId} className="player-row">
                                    <div
                                        className="player-avatar"
                                        style={{ background: p.avatarColor }}
                                    />
                                    <span
                                        className={`player-name ${!p.isConnected ? 'disconnected' : ''}`}
                                    >
                                        {p.nickname}
                                    </span>
                                    {p.sessionId === currentDrawer && (
                                        <span className="badge badge-drawer">✏️ Drawing</span>
                                    )}
                                    {p.role === 'guesser' && p.sessionId !== currentDrawer && (
                                        <span className="badge badge-guesser">🎯</span>
                                    )}
                                    {p.isHost && (
                                        <span className="badge badge-host">👑</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Spectators */}
            {(() => {
                const spectators = Array.from(players.values()).filter(
                    (p) => p.teamIndex === -1
                );
                if (spectators.length === 0) return null;
                return (
                    <div className="team-card" style={{ opacity: 0.7 }}>
                        <div className="team-card-header">
                            <span className="team-name" style={{ color: 'var(--text-muted)' }}>
                                👀 Spectators
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                {spectators.length}
                            </span>
                        </div>
                        <div className="team-players">
                            {spectators.map((p) => (
                                <div key={p.sessionId} className="player-row">
                                    <div
                                        className="player-avatar"
                                        style={{ background: p.avatarColor }}
                                    />
                                    <span className="player-name">{p.nickname}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
