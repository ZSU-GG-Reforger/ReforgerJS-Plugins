# ServerAdminTool-Plugins
Plugins for ReforgerJS

## Requirements
- ReforgerJS (1.4.0+)

## Installation
- Place the .js plugins file in the ReforgerJS plugins directory: `reforger-server/plugins`
- Insert in your ReforgerJS configuration file the plugin configuration, as shown in [Example Configuration](#example-configuration)

## Plugins

### ServerAdminToolsDBLog
This plugin logs all ServerAdminTools (SAT) events to your MySQL database for historical tracking and analysis. It creates and maintains the following tables:

- **sat_player_killed**: Records all player kills, including who killed whom, whether it was friendly fire, and if AI was involved
- **sat_base_capture**: Tracks when bases are captured and by which faction
- **sat_admin_action**: Logs all admin actions on the server (kicks, bans, etc.)
- **sat_game_end**: Records game completion events, including reason and winning faction

Each table includes a server ID field to differentiate data from multiple servers in the same database.

### ServerAdminToolsTeamkillAlert
This plugin sends real-time Discord alerts when teamkills (friendly fire) occur on your server. The alerts include:

- Server name
- Name of the player who committed the teamkill
- Name of the teammate who was killed

You can optionally ignore AI-caused teamkills by enabling the `ignoreAI` configuration option.

### ServerAdminToolsAdminAlert
This plugin notifies your Discord channel whenever an admin performs an action on the server. The alerts include:

- Server name
- Admin name- Action performed (kick, ban, etc.)
- Target player

This helps maintain transparency and keeps your staff and community informed about moderation actions.

### ServerAdminToolsGameEndAlert
This plugin sends a Discord notification when a game session ends on your server. The alerts include:

- Server name
- Reason for the game ending (e.g., "faction_victory")
- Winning faction or player

This allows community members to stay informed about match outcomes even when they're not online.

## Example Configuration

```json
{
  "plugins": [
    {
      "plugin": "ServerAdminToolsDBLog",
      "enabled": true
    },
    {
      "plugin": "ServerAdminToolsTeamkillAlert",
      "enabled": true,
      "channel": "YOUR_DISCORD_CHANNEL_ID_HERE",
      "ignoreAI": false
    },
    {
      "plugin": "ServerAdminToolsAdminAlert",
      "enabled": true,
      "channel": "YOUR_DISCORD_CHANNEL_ID_HERE"
    },
    {
      "plugin": "ServerAdminToolsGameEndAlert",
      "enabled": true,
      "channel": "YOUR_DISCORD_CHANNEL_ID_HERE"
    }
  ]
}