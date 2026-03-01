import React from 'react';
import type { ITeam, IPlayer } from '@pulsing-supernova/shared';
import type { GameMode } from '@pulsing-supernova/shared';
import type { Room } from 'colyseus.js';
import { MSG } from '@pulsing-supernova/shared';

interface GameOverProps {
    room: Room;
    teams: ITeam[];
    winningTeamIndex: number;
    myPlayer: IPlayer | null;
    // FFA props
    gameMode?: GameMode;
    players?: Map<string, IPlayer>;
    playerScores?: Map<string, number>;
    winnerSessionIds?: string[];
}

export function GameOver({ room, teams, winningTeamIndex, myPlayer, gameMode = 'teams', players = new Map(), playerScores = new Map(), winnerSessionIds = [] }: GameOverProps) {
    const handlePlayAgain = () => {
        room.send(MSG.PLAY_AGAIN);
    };

    // ─── FFA Game Over ────────────────────────────────────────
    if (gameMode === 'ffa') {
        const winners = winnerSessionIds
            .map(id => players.get(id))
            .filter(Boolean) as IPlayer[];

        const winnerNames = winners.map(p => p.nickname).join(' & ');
        const winnerColor = winners[0]?.avatarColor || 'var(--color-primary)';

        // Sort all players by score descending
        const sortedPlayers = Array.from(players.values())
            .filter(p => p.teamIndex >= 0 || winnerSessionIds.includes(p.sessionId))
            .sort((a, b) => (playerScores.get(b.sessionId) ?? 0) - (playerScores.get(a.sessionId) ?? 0));

        return (
            <div className="game-over-screen">
                <div className="animate-scale-in">
                    <h1 className="winner-title" style={{ color: winnerColor }}>
                        🏆 {winnerNames || 'Someone'} Wins!
                    </h1>
                    {winners.length > 1 && (
                        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                            🤝 It&apos;s a tie! Both players are champions!
                        </p>
                    )}
                </div>

                <div className="final-scores">
                    {sortedPlayers.map((p, idx) => {
                        const score = playerScores.get(p.sessionId) ?? 0;
                        const isWinner = winnerSessionIds.includes(p.sessionId);
                        return (
                            <div
                                key={p.sessionId}
                                className={`final-score-card ${isWinner ? 'winner' : ''}`}
                                style={{
                                    animationDelay: `${idx * 0.12}s`,
                                    borderColor: isWinner ? p.avatarColor : undefined,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                    <div className="player-avatar" style={{ background: p.avatarColor, width: 28, height: 28, flexShrink: 0 }} />
                                    <h3 style={{ color: p.avatarColor, margin: 0 }}>{p.nickname}</h3>
                                    {isWinner && <span style={{ fontSize: 'var(--font-lg)' }}>🏆</span>}
                                </div>
                                <div className="final-score-value" style={{ color: p.avatarColor }}>
                                    {score}
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-xs)' }}>
                                    points
                                </p>
                            </div>
                        );
                    })}
                </div>

                {myPlayer?.isHost && (
                    <button className="btn btn-primary btn-lg animate-fade-in" onClick={handlePlayAgain}>
                        🔄 Play Again
                    </button>
                )}
            </div>
        );
    }

    // Teams mode
    const winner = teams[winningTeamIndex];

    return (
        <div className="game-over-screen">
            <div className="animate-scale-in">
                <h1 className="winner-title" style={{ color: winner?.color || 'var(--text-primary)' }}>
                    🏆 {winner?.name || 'Team'} Wins!
                </h1>
            </div>

            <div className="final-scores">
                {teams.map((team, idx) => (
                    <div
                        key={idx}
                        className={`final-score-card ${idx === winningTeamIndex ? 'winner' : ''}`}
                        style={{
                            animationDelay: `${idx * 0.15}s`,
                            borderColor: idx === winningTeamIndex ? team.color : undefined,
                        }}
                    >
                        <h3 style={{ color: team.color, marginBottom: 'var(--space-sm)' }}>
                            {team.name}
                        </h3>
                        <div className="final-score-value" style={{ color: team.color }}>
                            {team.score}
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)', fontSize: 'var(--font-sm)' }}>
                            points
                        </p>
                    </div>
                ))}
            </div>

            {myPlayer?.isHost && (
                <button className="btn btn-primary btn-lg animate-fade-in" onClick={handlePlayAgain}>
                    🔄 Play Again
                </button>
            )}
        </div>
    );
}
