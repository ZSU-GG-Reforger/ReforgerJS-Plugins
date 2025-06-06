const { EmbedBuilder } = require("discord.js");

class ServerAdminToolsGameEndAlert {
  constructor(config) {
    this.config = config;
    this.name = "ServerAdminToolsGameEndAlert Plugin";
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
        (plugin) => plugin.plugin === "ServerAdminToolsGameEndAlert"
      );
      if (!pluginConfig || !pluginConfig.enabled || !pluginConfig.channel) {
        logger.warn("ServerAdminToolsGameEndAlert: Plugin disabled or missing channel configuration");
        return;
      }

      this.channelId = pluginConfig.channel;
      const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId, {
        cache: true,
        force: true,
      });

      const channelOrThread = await guild.channels.fetch(this.channelId);
      if (!channelOrThread || (!channelOrThread.isThread() && !channelOrThread.isTextBased())) {
        logger.error("ServerAdminToolsGameEndAlert: Invalid channel or thread ID");
        return;
      }

      this.channelOrThread = channelOrThread;

      const canSend = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "SendMessages"
      );

      if (!canSend) {
        logger.error("ServerAdminToolsGameEndAlert: Missing permissions to send messages in channel");
        return;
      }

      this.serverInstance.on("satGameEnd", this.handleGameEnd.bind(this));
      logger.info("ServerAdminToolsGameEndAlert: Plugin initialized successfully");
    } catch (error) {
      logger.error(`ServerAdminToolsGameEndAlert: Error initializing plugin: ${error.message}`);
    }
  }

  async handleGameEnd(data) {
    const reason = data.reason;
    const winner = data.winner;

    const embed = new EmbedBuilder()
      .setTitle(`Game Ended`)
      .setDescription(
        `**Server:** ${this.config.server.name}\n\n` +
        `**End Reason:** ${reason}\n` +
        `**Winner:** ${winner}`
      )
      .setColor("#FFD700")
      .setFooter({
        text: "ServerAdminTools GameEndAlert - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ embeds: [embed] });
      logger.verbose(`ServerAdminToolsGameEndAlert: Sent game end alert - Winner: ${winner}, Reason: ${reason}`);
    } catch (error) {
      logger.error(`ServerAdminToolsGameEndAlert: Failed to send game end alert: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners("satGameEnd");
      this.serverInstance = null;
    }
    this.channelOrThread = null;
    this.discordClient = null;
    logger.info("ServerAdminToolsGameEndAlert: Plugin cleaned up");
  }
}

module.exports = ServerAdminToolsGameEndAlert;