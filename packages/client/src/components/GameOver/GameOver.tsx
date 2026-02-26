import React from 'react';
import type { ITeam, IPlayer } from '@pulsing-supernova/shared';
import type { Room } from 'colyseus.js';
import { MSG } from '@pulsing-supernova/shared';

interface GameOverProps {
    room: Room;
    teams: ITeam[];
    winningTeamIndex: number;
    myPlayer: IPlayer | null;
}

export function GameOver({ room, teams, winningTeamIndex, myPlayer }: GameOverProps) {
    const winner = teams[winningTeamIndex];

    const handlePlayAgain = () => {
        room.send(MSG.PLAY_AGAIN);
    };

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
