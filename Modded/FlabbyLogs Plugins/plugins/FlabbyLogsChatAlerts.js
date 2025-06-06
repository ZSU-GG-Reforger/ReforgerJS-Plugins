const { EmbedBuilder } = require("discord.js");

class FlabbyLogsChatAlerts {
  constructor(config) {
    this.config = config;
    this.name = "FlabbyLogsChatAlerts Plugin";
    this.serverInstance = null;
    this.discordClient = null;
    this.channelOrThread = null;
    this.channelId = null;
    this.embedColor = "#7289DA";
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
        (plugin) => plugin.plugin === "FlabbyLogsChatAlerts"
      );
      if (!pluginConfig || !pluginConfig.enabled || !pluginConfig.channel) {
        logger.warn("FlabbyLogsChatAlerts: Plugin disabled or missing channel configuration");
        return;
      }

      this.channelId = pluginConfig.channel;
      
      this.channelFilters = pluginConfig.channelFilters || null;
      if (this.channelFilters) {
        logger.info(`FlabbyLogsChatAlerts: Channel filters active: ${this.channelFilters.join(', ')}`);
      }

      if (pluginConfig.embedColor) {
        this.embedColor = pluginConfig.embedColor;
        logger.info(`FlabbyLogsChatAlerts: Using custom embed color: ${this.embedColor}`);
      }

      const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId, {
        cache: true,
        force: true,
      });

      const channelOrThread = await guild.channels.fetch(this.channelId);
      if (!channelOrThread || (!channelOrThread.isThread() && !channelOrThread.isTextBased())) {
        logger.error("FlabbyLogsChatAlerts: Invalid channel or thread ID");
        return;
      }

      this.channelOrThread = channelOrThread;

      const canSend = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "SendMessages"
      );

      if (!canSend) {
        logger.error("FlabbyLogsChatAlerts: Missing permissions to send messages in channel");
        return;
      }

      this.serverInstance.on("chatMessage", this.handleChatMessage.bind(this));
      
      logger.info("FlabbyLogsChatAlerts: Plugin initialized successfully");
    } catch (error) {
      logger.error(`FlabbyLogsChatAlerts: Error initializing plugin: ${error.message}`);
    }
  }

  async handleChatMessage(data) {
    if (this.channelFilters && !this.channelFilters.includes(data.channelType)) {
      logger.verbose(`FlabbyLogsChatAlerts: Skipping message in channel type ${data.channelType} (filtered out)`);
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`In-Game Chat:`)
      .setDescription(`**Message from:** ${data.playerName}\n${data.message}`)
      .setColor(this.embedColor)
      .addFields(
        { name: 'Server', value: this.config.server.name, inline: true },
        { name: 'Channel', value: data.channelType, inline: true },
        { name: 'UUID', value: data.playerBiId, inline: false },
      )
      .setFooter({
        text: "Chat Logs - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ embeds: [embed] });
      logger.verbose(`FlabbyLogsChatAlerts: Sent chat message alert for ${data.playerName} in ${data.channelType} channel`);
    } catch (error) {
      logger.error(`FlabbyLogsChatAlerts: Failed to send chat message alert: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners("chatMessage");
      this.serverInstance = null;
    }
    this.channelOrThread = null;
    this.discordClient = null;
    logger.info("FlabbyLogsChatAlerts: Plugin cleaned up");
  }
}

module.exports = FlabbyLogsChatAlerts;