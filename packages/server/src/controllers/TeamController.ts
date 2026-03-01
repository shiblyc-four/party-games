import { ArraySchema } from '@colyseus/schema';
import { TeamSchema, PlayerSchema, GameState } from '../state/GameState.js';
import { TEAM_PRESETS } from '@pulsing-supernova/shared';

// Global FFA drawer queue is stored as teams[0].drawerQueue in FFA mode
const FFA_TEAM_INDEX = 0;

/**
 * TeamController — manages team assignment, validation, and drawer rotation.
 */
export class TeamController {
    constructor(private state: GameState) { }

    /** Initialize default teams (2 teams) */
    initTeams(count: number = 2): void {
        this.state.teams.clear();
        for (let i = 0; i < count; i++) {
            const team = new TeamSchema();
            const preset = TEAM_PRESETS[i];
            team.name = preset.name;
            team.color = preset.color;
            team.score = 0;
            team.drawerQueue = new ArraySchema<string>();
            this.state.teams.push(team);
        }
    }

    /** Add a player to a team */
    joinTeam(player: PlayerSchema, teamIndex: number): boolean {
        if (teamIndex < 0 || teamIndex >= this.state.teams.length) return false;

        // Remove from current team if any
        if (player.teamIndex >= 0) {
            this.removeFromTeam(player);
        }

        player.teamIndex = teamIndex;
        const team = this.state.teams[teamIndex];
        if (team) team.drawerQueue.push(player.sessionId);
        return true;
    }

    /** Set player as spectator */
    setSpectator(player: PlayerSchema): void {
        if (player.teamIndex >= 0) {
            this.removeFromTeam(player);
        }
        player.teamIndex = -1;
        player.role = 'spectator';
    }

    /** Remove player from their current team */
    private removeFromTeam(player: PlayerSchema): void {
        if (player.teamIndex < 0) return;
        const team = this.state.teams[player.teamIndex];
        if (!team) return;
        const idx = team.drawerQueue.indexOf(player.sessionId);
        if (idx !== -1) {
            team.drawerQueue.splice(idx, 1);
        }
        player.teamIndex = -1;
    }

    /** Get the next drawer from a team's queue (round-robin) */
    getNextDrawer(teamIndex: number): string | null {
        const team = this.state.teams[teamIndex];
        if (!team || team.drawerQueue.length === 0) return null;

        // Take from front, push to back
        const drawerId = team.drawerQueue.shift()!;
        team.drawerQueue.push(drawerId);
        return drawerId;
    }

    /** Assign roles to all players for a round */
    assignRoles(drawerSessionId: string, activeTeamIndex: number): void {
        this.state.players.forEach((player) => {
            if (player.sessionId === drawerSessionId) {
                player.role = 'drawer';
            } else if (player.teamIndex === activeTeamIndex) {
                player.role = 'guesser';
            } else if (player.teamIndex >= 0) {
                player.role = 'opponent';
            } else {
                player.role = 'spectator';
            }
        });
    }

    /** Check if teams have minimum players to start */
    canStartGame(): { ok: boolean; reason?: string } {
        const isFFA = this.state.settings.gameMode === 'ffa';

        if (isFFA) {
            const activePlayers = Array.from(this.state.players.values()).filter(
                (p) => p.isConnected
            );
            if (activePlayers.length < 2) {
                return { ok: false, reason: 'At least 2 players are needed to start.' };
            }
            return { ok: true };
        }

        // Teams mode
        const teamsWithPlayers = this.state.teams.filter(
            (t) => t.drawerQueue.length > 0
        );
        if (teamsWithPlayers.length < 2) {
            return { ok: false, reason: 'At least 2 teams need players to start.' };
        }
        for (const team of this.state.teams) {
            if (team.drawerQueue.length > 0 && team.drawerQueue.length < 1) {
                return { ok: false, reason: `${team.name} needs at least 1 player.` };
            }
        }
        return { ok: true };
    }

    // ─── FFA methods ─────────────────────────────────────────────────

    /**
     * Initialize FFA mode — all connected players go into a single global drawer queue.
     * We reuse teams[0] as the global "pool" to keep Colyseus schema lean.
     */
    initFFA(): void {
        this.state.teams.clear();
        const pool = new TeamSchema();
        pool.name = 'FFA';
        pool.color = '#ffffff';
        pool.score = 0;
        pool.drawerQueue = new ArraySchema<string>();
        this.state.teams.push(pool);

        // Add all currently connected players
        this.state.players.forEach((player) => {
            if (player.isConnected) {
                player.teamIndex = FFA_TEAM_INDEX;
                pool.drawerQueue.push(player.sessionId);
            }
        });
    }

    /** Assign drawer role to one player, guesser to all other non-spectators */
    assignFFARoles(drawerSessionId: string): void {
        this.state.players.forEach((player) => {
            if (player.sessionId === drawerSessionId) {
                player.role = 'drawer';
            } else if (player.teamIndex === FFA_TEAM_INDEX) {
                player.role = 'guesser';
            } else {
                player.role = 'spectator';
            }
        });
    }

    /** Get next drawer from the FFA global queue (round-robin) */
    getNextFFADrawer(): string | null {
        const pool = this.state.teams[FFA_TEAM_INDEX];
        if (!pool || pool.drawerQueue.length === 0) return null;
        const drawerId = pool.drawerQueue.shift()!;
        pool.drawerQueue.push(drawerId);
        return drawerId;
    }

    /**
     * Get a non-tied player to be the drawer in sudden death.
     * Picks the next player in the FFA queue who is NOT in tiedIds.
     */
    getSuddenDeathDrawer(tiedIds: string[]): string | null {
        const pool = this.state.teams[FFA_TEAM_INDEX];
        if (!pool) return null;
        for (const id of pool.drawerQueue) {
            if (!tiedIds.includes(id)) {
                const player = this.state.players.get(id);
                if (player?.isConnected) return id;
            }
        }
        // Edge case: all remaining are tied — use first tied player (won't affect outcome)
        return tiedIds[0] ?? null;
    }

    /** Handle player disconnect — remove from team queue */
    handleDisconnect(player: PlayerSchema): void {
        player.isConnected = false;
    }

    /** Handle reconnect */
    handleReconnect(player: PlayerSchema): void {
        player.isConnected = true;
    }
}
