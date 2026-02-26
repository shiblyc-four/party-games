import { useState, useCallback, useRef } from 'react';
import { Client, Room } from 'colyseus.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3001';

interface ColyseusState {
    room: Room | null;
    error: string | null;
    isConnecting: boolean;
}

/**
 * useColyseus — manages connection to the Colyseus game server.
 * Handles creating/joining rooms and reconnection.
 */
export function useColyseus() {
    const clientRef = useRef<Client>(new Client(SERVER_URL));
    const [state, setState] = useState<ColyseusState>({
        room: null,
        error: null,
        isConnecting: false,
    });

    // Set up room event listeners
    const setupRoomListeners = useCallback((room: Room) => {
        room.onLeave((code: number) => {
            console.log(`Left room with code: ${code}`);
            // Only clear room state on actual disconnection
            // Normal leave (1000) or abnormal close (>= 4000)
            setState((s) => ({
                ...s,
                room: null,
                error: code >= 4000 ? 'Disconnected from room' : null,
            }));
        });

        room.onError((code: number, message?: string) => {
            console.error(`Room error ${code}: ${message}`);
            setState((s) => ({
                ...s,
                error: message || `Error code: ${code}`,
            }));
        });
    }, []);

    // Create a new room
    const createRoom = useCallback(async (nickname: string) => {
        setState((s) => ({ ...s, isConnecting: true, error: null }));

        try {
            const room = await clientRef.current.create('pictionary', { nickname });
            setupRoomListeners(room);
            setState({
                room,
                isConnecting: false,
                error: null,
            });
        } catch (err: any) {
            console.error('Failed to create room:', err);
            setState({
                room: null,
                isConnecting: false,
                error: err.message || 'Failed to create room',
            });
        }
    }, [setupRoomListeners]);

    // Join an existing room by custom room code
    const joinRoom = useCallback(async (roomCode: string, nickname: string) => {
        setState((s) => ({ ...s, isConnecting: true, error: null }));

        try {
            // Look up available rooms to find the one matching our custom code
            const rooms = await clientRef.current.getAvailableRooms('pictionary');
            const target = rooms.find(
                (r) => r.metadata?.roomCode?.toUpperCase() === roomCode.toUpperCase()
            );

            if (!target) {
                setState({
                    room: null,
                    isConnecting: false,
                    error: `Room "${roomCode}" not found. Check the code and try again.`,
                });
                return;
            }

            const room = await clientRef.current.joinById(target.roomId, { nickname });
            setupRoomListeners(room);
            setState({
                room,
                isConnecting: false,
                error: null,
            });
        } catch (err: any) {
            console.error('Failed to join room:', err);
            setState({
                room: null,
                isConnecting: false,
                error: err.message || 'Failed to join room',
            });
        }
    }, [setupRoomListeners]);

    // Leave current room
    const leaveRoom = useCallback(() => {
        state.room?.leave();
        setState({
            room: null,
            error: null,
            isConnecting: false,
        });
    }, [state.room]);

    return {
        ...state,
        createRoom,
        joinRoom,
        leaveRoom,
    };
}
