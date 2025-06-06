const { EmbedBuilder } = require("discord.js");

class ServerAdminToolsAdminAlert {
  constructor(config) {
    this.config = config;
    this.name = "ServerAdminToolsAdminAlert Plugin";
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
        (plugin) => plugin.plugin === "ServerAdminToolsAdminAlert"
      );
      if (!pluginConfig || !pluginConfig.enabled || !pluginConfig.channel) {
        logger.warn("ServerAdminToolsAdminAlert: Plugin disabled or missing channel configuration");
        return;
      }

      this.channelId = pluginConfig.channel;
      const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId, {
        cache: true,
        force: true,
      });

      const channelOrThread = await guild.channels.fetch(this.channelId);
      if (!channelOrThread || (!channelOrThread.isThread() && !channelOrThread.isTextBased())) {
        logger.error("ServerAdminToolsAdminAlert: Invalid channel or thread ID");
        return;
      }

      this.channelOrThread = channelOrThread;

      const canSend = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "SendMessages"
      );

      if (!canSend) {
        logger.error("ServerAdminToolsAdminAlert: Missing permissions to send messages in channel");
        return;
      }

      this.serverInstance.on("adminAction", this.handleAdminAction.bind(this));
      logger.info("ServerAdminToolsAdminAlert: Plugin initialized successfully");
    } catch (error) {
      logger.error(`ServerAdminToolsAdminAlert: Error initializing plugin: ${error.message}`);
    }
  }

  async handleAdminAction(data) {
    const action = data.action;
    const adminName = data.adminName;
    const targetPlayer = data.targetPlayer;

    const embed = new EmbedBuilder()
      .setTitle(`Admin Action: ${action}`)
      .setDescription(
        `**Server:** ${this.config.server.name}\n\n` +
        `**Admin:** ${adminName}\n` +
        `**Action:** ${action}\n` +
        `**Target:** ${targetPlayer}`
      )
      .setColor("#7289DA")
      .setFooter({
        text: "ServerAdminTools AdminAlert - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ embeds: [embed] });
      logger.verbose(`ServerAdminToolsAdminAlert: Sent admin action alert for ${adminName} using ${action} on ${targetPlayer}`);
    } catch (error) {
      logger.error(`ServerAdminToolsAdminAlert: Failed to send admin action alert: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners("adminAction");
      this.serverInstance = null;
    }
    this.channelOrThread = null;
    this.discordClient = null;
    logger.info("ServerAdminToolsAdminAlert: Plugin cleaned up");
  }
}

module.exports = ServerAdminToolsAdminAlert;