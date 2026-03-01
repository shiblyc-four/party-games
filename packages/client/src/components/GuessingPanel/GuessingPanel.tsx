import React, { useState, useRef, useEffect } from 'react';
import type { Room } from 'colyseus.js';
import type { IGuessEntry, IChatEntry, PlayerRole } from '@pulsing-supernova/shared';
import { MSG } from '@pulsing-supernova/shared';

interface GuessingPanelProps {
    room: Room;
    role: PlayerRole;
    guesses: IGuessEntry[];
    chatMessages: IChatEntry[];
    teamName?: string;
    // FFA
    isFFA?: boolean;
    isSuddenDeath?: boolean;
    winnerSessionIds?: string[];
    mySessionId?: string;
}

/**
 * GuessingPanel — separated into a guess section (compact, top) and chat section (larger, bottom).
 * Guessers get a prominent guess input; everyone always gets a chat input.
 */
export function GuessingPanel({
    room,
    role,
    guesses,
    chatMessages,
    teamName,
    isFFA = false,
    isSuddenDeath = false,
    winnerSessionIds = [],
    mySessionId = '',
}: GuessingPanelProps) {
    const [guessText, setGuessText] = useState('');
    const [chatText, setChatText] = useState('');
    const guessEndRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll guess feed
    useEffect(() => {
        guessEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [guesses.length]);

    // Auto-scroll chat feed
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages.length]);

    const handleGuessSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guessText.trim()) return;
        room.send(MSG.GUESS, { text: guessText.trim() });
        setGuessText('');
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatText.trim()) return;
        room.send(MSG.CHAT, { text: chatText.trim() });
        setChatText('');
    };

    // In FFA, any non-drawer can guess; in sudden death only tied players (role = guesser)
    const isGuesser = isFFA
        ? (role !== 'drawer')
        : (role === 'guesser');
    const iAmTied = isSuddenDeath && winnerSessionIds.includes(mySessionId);
    const canGuessSuddenDeath = !isSuddenDeath || iAmTied;

    return (
        <div className="sidebar-panels">
            {/* Sudden death banner */}
            {isSuddenDeath && (
                <div className="sudden-death-banner animate-pulse">
                    ⚡ Sudden Death!
                    {iAmTied
                        ? ' Race to guess first — you win the game!'
                        : ' Tied players are racing to guess...'}
                </div>
            )}

            {/* ── Guess Section (compact) ──────────────────── */}
            <div className={`guess-section ${isGuesser && canGuessSuddenDeath ? 'active-guesser' : ''}`}>
                <div className="section-header guess-header">
                    {isGuesser && canGuessSuddenDeath ? (
                        <span className="guess-header-active">
                            🎯 {isSuddenDeath ? 'SUDDEN DEATH — Guess now!' : (isFFA ? 'Guess Now!' : `Guess Now — ${teamName}!`)}
                        </span>
                    ) : (
                        <span>🎯 Guesses</span>
                    )}
                </div>

                <div className="guess-feed">
                    {guesses.length === 0 && (
                        <div className="feed-empty">
                            {isGuesser
                                ? 'Type your guess below!'
                                : 'No guesses yet...'}
                        </div>
                    )}
                    {guesses.map((g, i) => (
                        <div
                            key={i}
                            className={`feed-entry ${g.isCorrect ? 'correct' : ''}`}
                        >
                            <span className="feed-nick">{g.nickname}:</span>
                            <span>{g.text}</span>
                        </div>
                    ))}
                    <div ref={guessEndRef} />
                </div>

                {isGuesser && canGuessSuddenDeath && (
                    <form className="guess-input-area" onSubmit={handleGuessSubmit}>
                        <input
                            className="input guess-input"
                            type="text"
                            placeholder="Type your guess..."
                            value={guessText}
                            onChange={(e) => setGuessText(e.target.value)}
                            maxLength={100}
                            autoComplete="off"
                            autoFocus
                        />
                        <button type="submit" className="btn btn-guess">
                            🎯 Guess
                        </button>
                    </form>
                )}
            </div>

            {/* ── Chat Section (larger) ───────────────────── */}
            <div className="chat-section">
                <div className="section-header chat-header">
                    💬 Chat
                </div>

                <div className="chat-feed">
                    {chatMessages.length === 0 && (
                        <div className="feed-empty">No messages yet...</div>
                    )}
                    {chatMessages.map((c, i) => (
                        <div key={i} className="feed-entry chat">
                            <span className="feed-nick">{c.nickname}:</span>
                            <span>{c.text}</span>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleChatSubmit}>
                    <input
                        className="input"
                        type="text"
                        placeholder="Chat..."
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        maxLength={200}
                        autoComplete="off"
                    />
                    <button type="submit" className="btn btn-primary">
                        →
                    </button>
                </form>
            </div>
        </div>
    );
}
