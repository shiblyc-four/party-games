import React, { useState } from 'react';

interface LobbyProps {
    onCreateRoom: (nickname: string) => Promise<void>;
    onJoinRoom: (roomId: string, nickname: string) => Promise<void>;
    error: string | null;
    isConnecting: boolean;
}

export function Lobby({ onCreateRoom, onJoinRoom, error, isConnecting }: LobbyProps) {
    const [nickname, setNickname] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [mode, setMode] = useState<'main' | 'join'>('main');

    const handleCreate = () => {
        if (!nickname.trim()) return;
        onCreateRoom(nickname.trim());
    };

    const handleJoin = () => {
        if (!nickname.trim() || !roomCode.trim()) return;
        onJoinRoom(roomCode.trim(), nickname.trim());
    };

    return (
        <div className="lobby-screen">
            <div className="animate-fade-in">
                <h1 className="lobby-logo">
                    Pulsing<br />Supernova
                </h1>
                <p className="lobby-subtitle">Draw. Guess. Win. — Party games with friends</p>
            </div>

            <div className="glass-card lobby-card animate-slide-up">
                {mode === 'main' ? (
                    <>
                        <h2>Join the Party</h2>
                        <div className="lobby-form">
                            <input
                                className="input"
                                type="text"
                                placeholder="Your nickname"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                maxLength={20}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                autoFocus
                            />
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleCreate}
                                disabled={isConnecting || !nickname.trim()}
                            >
                                {isConnecting ? '✨ Creating...' : '🎨 Create Room'}
                            </button>

                            <div className="lobby-divider">or</div>

                            <button
                                className="btn btn-secondary btn-lg"
                                onClick={() => setMode('join')}
                                disabled={!nickname.trim()}
                            >
                                🔗 Join with Code
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2>Join Room</h2>
                        <div className="lobby-form">
                            <input
                                className="input"
                                type="text"
                                placeholder="Your nickname"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                maxLength={20}
                            />
                            <input
                                className="input"
                                type="text"
                                placeholder="Room code (e.g. ABC12)"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={5}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                                style={{ textTransform: 'uppercase', letterSpacing: '3px', textAlign: 'center' }}
                            />
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleJoin}
                                disabled={isConnecting || !nickname.trim() || !roomCode.trim()}
                            >
                                {isConnecting ? '✨ Joining...' : '🚀 Join'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setMode('main')}
                            >
                                ← Back
                            </button>
                        </div>
                    </>
                )}

                {error && (
                    <p style={{ marginTop: 'var(--space-md)', color: 'var(--accent-danger)', textAlign: 'center', fontSize: 'var(--font-sm)' }}>
                        ⚠️ {error}
                    </p>
                )}
            </div>
        </div>
    );
}
