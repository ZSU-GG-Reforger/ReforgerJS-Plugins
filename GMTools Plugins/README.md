# GMTools-Plugins
Plugins for ReforgerJS

## Requirements
- ReforgerJS (1.4.0+)

## Installation
- Place the .js plugins file in the ReforgerJS plugins directory: `reforger-server/plugins`
- Insert in your ReforgerJS configuration file the plugin configuration, as shown in [Example Configuration](#example-configuration)

## Plugins

### GMToolsDBLog
This plugin logs all Game Master tool usage to your MySQL database for historical tracking and auditing. It creates and maintains the following tables:

- **gmtools_status**: Records when players enter or exit Game Master mode, including player information and status
- **gmtools_duration**: Tracks how long each player spent in Game Master mode with exact duration in seconds

Each table includes a server ID field to differentiate data from multiple servers in the same database.

### GMToolsAlert
This plugin sends real-time Discord alerts when Game Master tools are used on your server. The alerts include:

- Server name
- Admin name (the player who used GM mode)
- Player ID
- Status (Enter or Exit)
- For exit events, the duration spent in GM mode (formatted for readability)

You can optionally disable entry alerts by enabling the `disableEnterAlerts` configuration option, which will only send notifications when someone exits GM mode.

## Example Configuration

```json
{
  "plugins": [
    {
      "plugin": "GMToolsDBLog",
      "enabled": true
    },
    {
      "plugin": "GMToolsAlert",
      "enabled": true,
      "channel": "YOUR_DISCORD_CHANNEL_ID_HERE",
      "disableEnterAlerts": false
    }
  ]
}