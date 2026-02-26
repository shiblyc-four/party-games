import { ArraySchema } from '@colyseus/schema';
import { TeamSchema, PlayerSchema, GameState } from '../state/GameState.js';
import { TEAM_PRESETS } from '@pulsing-supernova/shared';

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

    /** Handle player disconnect — remove from team queue */
    handleDisconnect(player: PlayerSchema): void {
        player.isConnected = false;
    }

    /** Handle reconnect */
    handleReconnect(player: PlayerSchema): void {
        player.isConnected = true;
    }
}
