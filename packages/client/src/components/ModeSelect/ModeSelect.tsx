import React from 'react';
import type { Room } from 'colyseus.js';
import type { IPlayer, GameMode } from '@pulsing-supernova/shared';
import { MSG } from '@pulsing-supernova/shared';

interface ModeSelectProps {
    room: Room;
    roomCode: string;
    myPlayer: IPlayer | null;
    playerCount: number;
}

export function ModeSelect({ room, roomCode, myPlayer, playerCount }: ModeSelectProps) {
    const isHost = myPlayer?.isHost ?? false;

    const handleSelect = (mode: GameMode) => {
        if (!isHost) return;
        room.send(MSG.SET_GAME_MODE, { gameMode: mode });
    };

    return (
        <div className="mode-select-screen lobby-screen">
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                    🎮 Game Mode
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2xl)' }}>
                    Room Code:{' '}
                    <strong style={{ letterSpacing: '3px', fontSize: 'var(--font-xl)' }}>
                        {roomCode}
                    </strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-md)', fontSize: 'var(--font-sm)' }}>
                        ({playerCount} {playerCount === 1 ? 'player' : 'players'})
                    </span>
                </p>
            </div>

            {isHost ? (
                <div className="mode-cards animate-slide-up">
                    {/* Team Battle card */}
                    <button
                        className="mode-card glass-card"
                        onClick={() => handleSelect('teams')}
                        id="btn-mode-teams"
                    >
                        <div className="mode-card-icon">⚔️</div>
                        <h2 className="mode-card-title">Team Battle</h2>
                        <p className="mode-card-desc">
                            Split into teams. Your teammates guess while you draw.
                            Work together to outscore the other team.
                        </p>
                        <ul className="mode-card-rules">
                            <li>🧑‍🤝‍🧑 Requires 4+ players (2 per team)</li>
                            <li>🎯 Teammates guess; opponents can&apos;t</li>
                            <li>🏆 First team to the target score wins</li>
                        </ul>
                        <div className="mode-card-cta btn btn-primary">
                            Choose Teams →
                        </div>
                    </button>

                    {/* Free For All card */}
                    <button
                        className="mode-card glass-card mode-card-ffa"
                        onClick={() => handleSelect('ffa')}
                        id="btn-mode-ffa"
                    >
                        <div className="mode-card-icon">🎯</div>
                        <h2 className="mode-card-title">Free For All</h2>
                        <p className="mode-card-desc">
                            Everyone plays individually. One person draws,
                            everyone else races to guess first!
                        </p>
                        <ul className="mode-card-rules">
                            <li>👤 Works with just 2 players!</li>
                            <li>⚡ Whoever guesses first scores</li>
                            <li>🔄 Everyone takes a turn drawing</li>
                            <li>🤺 Tie? Sudden death decides the winner!</li>
                        </ul>
                        <div className="mode-card-cta btn btn-success">
                            Choose FFA →
                        </div>
                    </button>
                </div>
            ) : (
                <div className="animate-pulse" style={{ textAlign: 'center', marginTop: 'var(--space-3xl)' }}>
                    <p style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-secondary)' }}>
                        ⏳ Waiting for the host to pick a game mode...
                    </p>
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
                        The host ({Array.from([myPlayer]).find(p => p?.isHost)?.nickname || 'host'}) is choosing
                    </p>
                </div>
            )}
        </div>
    );
}
