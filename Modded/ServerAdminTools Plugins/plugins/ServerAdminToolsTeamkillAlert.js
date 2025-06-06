const { EmbedBuilder } = require("discord.js");

class ServerAdminToolsTeamkillAlert {
  constructor(config) {
    this.config = config;
    this.name = "ServerAdminToolsTeamkillAlert Plugin";
    this.serverInstance = null;
    this.discordClient = null;
    this.channelOrThread = null;
    this.channelId = null;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async checkPermissionsWithRetry(channel, user, permission, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
      const perms = channel.permissionsFor(user);
      if (perms && perms.has(permission)) {
        return true;
      }
      await this.delay(delayMs);
    }
    return false;
  }

  async prepareToMount(serverInstance, discordClient) {
    await this.cleanup();
    this.serverInstance = serverInstance;
    this.discordClient = discordClient;

    try {
      const pluginConfig = this.config.plugins.find(
        (plugin) => plugin.plugin === "ServerAdminToolsTeamkillAlert"
      );
      if (!pluginConfig || !pluginConfig.enabled || !pluginConfig.channel) {
        logger.warn("ServerAdminToolsTeamkillAlert: Plugin disabled or missing channel configuration");
        return;
      }

      this.channelId = pluginConfig.channel;
      const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId, {
        cache: true,
        force: true,
      });

      const channelOrThread = await guild.channels.fetch(this.channelId);
      if (!channelOrThread || (!channelOrThread.isThread() && !channelOrThread.isTextBased())) {
        logger.error("ServerAdminToolsTeamkillAlert: Invalid channel or thread ID");
        return;
      }

      this.channelOrThread = channelOrThread;

      const canSend = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "SendMessages"
      );

      if (!canSend) {
        logger.error("ServerAdminToolsTeamkillAlert: Missing permissions to send messages in channel");
        return;
      }

      this.serverInstance.on("satPlayerKilled", this.handlePlayerKilled.bind(this));
      logger.info("ServerAdminToolsTeamkillAlert: Plugin initialized successfully");
    } catch (error) {
      logger.error(`ServerAdminToolsTeamkillAlert: Error initializing plugin: ${error.message}`);
    }
  }

  async handlePlayerKilled(data) {
    if (!data.friendlyFire) {
      return;
    }

    const pluginConfig = this.config.plugins.find(
      (plugin) => plugin.plugin === "ServerAdminToolsTeamkillAlert"
    );
    if (pluginConfig.ignoreAI && data.isAI) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Teamkill Detected!")
      .setDescription(
        `**Server:** ${this.config.server.name}\n\n` +
        `**Player:** ${data.instigatorName}\n` +
        `**Killed teammate:** ${data.playerName}`
      )
      .setColor("#FF0000")
      .setFooter({
        text: "ServerAdminTools TeamkillAlert - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ embeds: [embed] });
      logger.verbose(`ServerAdminToolsTeamkillAlert: Sent teamkill alert for ${data.instigatorName} killing ${data.playerName}`);
    } catch (error) {
      logger.error(`ServerAdminToolsTeamkillAlert: Failed to send teamkill alert: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners("satPlayerKilled");
      this.serverInstance = null;
    }
    this.channelOrThread = null;
    this.discordClient = null;
    logger.info("ServerAdminToolsTeamkillAlert: Plugin cleaned up");
  }
}

module.exports = ServerAdminToolsTeamkillAlert;