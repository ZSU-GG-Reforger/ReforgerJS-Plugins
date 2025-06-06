const { EmbedBuilder } = require("discord.js");

class GMToolsAlert {
  constructor(config) {
    this.config = config;
    this.name = "GMToolsAlert Plugin";
    this.serverInstance = null;
    this.discordClient = null;
    this.channelOrThread = null;
    this.channelId = null;
    this.disableEnterAlerts = false;
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
        (plugin) => plugin.plugin === "GMToolsAlert"
      );
      if (!pluginConfig || !pluginConfig.enabled || !pluginConfig.channel) {
        logger.warn("GMToolsAlert: Plugin disabled or missing channel configuration");
        return;
      }

      this.channelId = pluginConfig.channel;
      
      if (pluginConfig.disableEnterAlerts === true) {
        this.disableEnterAlerts = true;
        logger.info("GMToolsAlert: Enter alerts are disabled per configuration");
      }

      const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId, {
        cache: true,
        force: true,
      });

      const channelOrThread = await guild.channels.fetch(this.channelId);
      if (!channelOrThread || (!channelOrThread.isThread() && !channelOrThread.isTextBased())) {
        logger.error("GMToolsAlert: Invalid channel or thread ID");
        return;
      }

      this.channelOrThread = channelOrThread;

      const canSend = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "SendMessages"
      );

      if (!canSend) {
        logger.error("GMToolsAlert: Missing permissions to send messages in channel");
        return;
      }

      this.serverInstance.on("gmToolsStatus", this.handleGMToolsStatus.bind(this));
      this.serverInstance.on("gmToolsTime", this.handleGMToolsTime.bind(this));
      
      logger.info("GMToolsAlert: Plugin initialized successfully");
    } catch (error) {
      logger.error(`GMToolsAlert: Error initializing plugin: ${error.message}`);
    }
  }

  async handleGMToolsStatus(data) {
    if (data.status !== 'Enter') {
      return;
    }
    
    if (this.disableEnterAlerts) {
      logger.verbose(`GMToolsAlert: Skipping GM mode entry alert for ${data.playerName} (Enter alerts disabled)`);
      return;
    }
    
    const playerName = data.playerName;
    const playerId = data.playerId;

    const embed = new EmbedBuilder()
      .setTitle(`🛠️ Admin Entered GM Mode`)
      .setDescription(
        `**Server:** ${this.config.server.name}\n\n` +
        `**Admin:** ${playerName}\n` +
        `**Player ID:** ${playerId}`
      )
      .setColor("#FFD700")
      .setFooter({
        text: "GMTools Alert - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ embeds: [embed] });
      logger.verbose(`GMToolsAlert: Sent GM mode entry alert for ${playerName}`);
    } catch (error) {
      logger.error(`GMToolsAlert: Failed to send GM mode entry alert: ${error.message}`);
    }
  }

  async handleGMToolsTime(data) {
    const playerName = data.playerName;
    const playerId = data.playerId;
    const duration = data.duration;
    
    const formattedDuration = this.formatDuration(duration);

    const embed = new EmbedBuilder()
      .setTitle(`🕒 Admin Exited GM Mode`)
      .setDescription(
        `**Server:** ${this.config.server.name}\n\n` +
        `**Admin:** ${playerName}\n` +
        `**Player ID:** ${playerId}\n` +
        `**Duration in GM Mode:** ${formattedDuration}`
      )
      .setColor("#4A90E2")
      .setFooter({
        text: "GMTools Alert - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ embeds: [embed] });
      logger.verbose(`GMToolsAlert: Sent GM mode exit alert for ${playerName}, duration: ${duration} seconds`);
    } catch (error) {
      logger.error(`GMToolsAlert: Failed to send GM mode exit alert: ${error.message}`);
    }
  }
  
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds.toFixed(2)} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds.toFixed(0)} second${remainingSeconds !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners("gmToolsStatus");
      this.serverInstance.removeAllListeners("gmToolsTime");
      this.serverInstance = null;
    }
    this.channelOrThread = null;
    this.discordClient = null;
    logger.info("GMToolsAlert: Plugin cleaned up");
  }
}

module.exports = GMToolsAlert;