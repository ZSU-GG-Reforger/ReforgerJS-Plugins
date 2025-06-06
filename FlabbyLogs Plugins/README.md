# FlabbyLogs Plugins
Plugins for enhancing chat functionality in ReforgerJS

## Requirements
- ReforgerJS (1.4.0+)
- Flabby Chat Logs enabled on your server

## Installation
- Place the .js plugins file in the ReforgerJS plugins directory: `reforger-server/plugins`
- Insert in your ReforgerJS configuration file the plugin configuration, as shown in [Example Configuration](#example-configuration)

## Plugins

### FlabbyLogsChatDBLog
This plugin logs all in-game chat messages to your MySQL database for archiving and analysis. It creates and maintains a comprehensive table:

- **flabbylogs_chatmessages**: Records all player chat messages with details including:
 - Server ID (to differentiate between multiple servers)
 - Player information (name, UUID)
 - Message content
 - Channel type and ID
 - Timestamp
 - Additional context (sender faction, server name)

The database entries are protected against SQL injection and provide a complete historical record of communication on your server.

### FlabbyLogsChatAlerts
This plugin forwards in-game chat messages to a Discord channel, providing real-time visibility into server communication. Each message is formatted as an embed containing:

- Message content
- Player name who sent the message
- Server name
- Chat channel type (Global, Faction, Group, Vehicle, Local)
- Player UUID for reference
- Timestamp

You can optionally filter which chat channels are forwarded to Discord using the `channelFilters` configuration.

### FlabbyLogsAdminPings
This plugin monitors chat for admin help requests and sends alerts to Discord with optional role pings. It offers advanced filtering capabilities to reduce noise:

- Triggers only when a message starts with a specified command (default: `!admin`)
- Can be configured to ignore messages containing specific phrases
- Optionally pings Discord roles when help is needed
- Forwards information including the player's request, name, and server context

This helps server administrators respond quickly to player needs while filtering out common issues.

## Example Configuration

```json
{
 "plugins": [
   {
     "plugin": "FlabbyLogsChatDBLog",
     "enabled": true
   },
   {
     "plugin": "FlabbyLogsChatAlerts",
     "enabled": true,
     "channel": "YOUR_DISCORD_CHANNEL_ID_HERE",
     "channelFilters": ["Global", "Faction", "Group", "Vehicle", "Local"]
   },
   {
     "plugin": "FlabbyLogsAdminPings",
     "enabled": true,
     "channel": "YOUR_DISCORD_CHANNEL_ID_HERE",
     "channelFilters": ["Global", "Faction", "Group", "Vehicle", "Local"],
     "ignorePhrases": ["flip", "flipped"],
     "pingRoles": true,
     "roles": ["ROLE_ID_1"],
     "command": "admin"
   }
 ]
}