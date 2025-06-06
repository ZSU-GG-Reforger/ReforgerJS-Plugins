const { EmbedBuilder } = require("discord.js");

class FlabbyLogsAdminPings {
  constructor(config) {
    this.config = config;
    this.name = "FlabbyLogsAdminPings Plugin";
    this.serverInstance = null;
    this.discordClient = null;
    this.channelOrThread = null;
    this.channelId = null;
    this.embedColor = "#FF0000";
    this.command = "!admin";
    this.ignorePhrases = [];
    this.pingRolesEnabled = false;
    this.roles = [];
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
        (plugin) => plugin.plugin === "FlabbyLogsAdminPings"
      );
      if (!pluginConfig || !pluginConfig.enabled || !pluginConfig.channel) {
        logger.warn("FlabbyLogsAdminPings: Plugin disabled or missing channel configuration");
        return;
      }

      this.channelId = pluginConfig.channel;
      
      this.channelFilters = pluginConfig.channelFilters || null;
      if (this.channelFilters) {
        logger.info(`FlabbyLogsAdminPings: Channel filters active: ${this.channelFilters.join(', ')}`);
      }

      if (pluginConfig.command) {
        this.command = pluginConfig.command.startsWith("!") ? pluginConfig.command : `!${pluginConfig.command}`;
        logger.info(`FlabbyLogsAdminPings: Using command trigger: ${this.command}`);
      }
      
      if (pluginConfig.ignorePhrases && Array.isArray(pluginConfig.ignorePhrases)) {
        this.ignorePhrases = pluginConfig.ignorePhrases.map(phrase => phrase.toLowerCase());
        logger.info(`FlabbyLogsAdminPings: Ignore phrases configured: ${this.ignorePhrases.join(', ')}`);
      }
      
      this.pingRolesEnabled = !!pluginConfig.pingRoles;
      
      if (this.pingRolesEnabled && pluginConfig.roles && Array.isArray(pluginConfig.roles)) {
        this.roles = pluginConfig.roles.filter(role => role && role.trim() !== '');
        logger.info(`FlabbyLogsAdminPings: Role pings enabled with roles: ${this.roles.join(', ')}`);
        
        try {
          const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId);
          for (const roleId of this.roles) {
            try {
              const role = await guild.roles.fetch(roleId);
              if (role) {
                logger.info(`FlabbyLogsAdminPings: Successfully found role: ${role.name} (${roleId})`);
              } else {
                logger.warn(`FlabbyLogsAdminPings: Role with ID ${roleId} not found in guild`);
              }
            } catch (roleError) {
              logger.warn(`FlabbyLogsAdminPings: Error fetching role ${roleId}: ${roleError.message}`);
            }
          }
        } catch (guildError) {
          logger.error(`FlabbyLogsAdminPings: Error fetching guild roles: ${guildError.message}`);
        }
      } else if (this.pingRolesEnabled) {
        logger.warn("FlabbyLogsAdminPings: Role pings enabled but no valid roles configured");
      }

      if (pluginConfig.embedColor) {
        this.embedColor = pluginConfig.embedColor;
      }

      const guild = await this.discordClient.guilds.fetch(this.config.connectors.discord.guildId, {
        cache: true,
        force: true,
      });

      const channelOrThread = await guild.channels.fetch(this.channelId);
      if (!channelOrThread || (!channelOrThread.isThread() && !channelOrThread.isTextBased())) {
        logger.error("FlabbyLogsAdminPings: Invalid channel or thread ID");
        return;
      }

      this.channelOrThread = channelOrThread;

      const canSend = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "SendMessages"
      );

      if (!canSend) {
        logger.error("FlabbyLogsAdminPings: Missing permissions to send messages in channel");
        return;
      }
      
      const canMentionEveryone = await this.checkPermissionsWithRetry(
        this.channelOrThread,
        this.discordClient.user,
        "MentionEveryone"
      );
      
      if (this.pingRolesEnabled && !canMentionEveryone) {
        logger.warn("FlabbyLogsAdminPings: Bot lacks permission to mention @everyone/@here/roles in this channel");
      }

      this.serverInstance.on("chatMessage", this.handleChatMessage.bind(this));
      
      logger.info("FlabbyLogsAdminPings: Plugin initialized successfully");
    } catch (error) {
      logger.error(`FlabbyLogsAdminPings: Error initializing plugin: ${error.message}`);
    }
  }

  shouldIgnoreMessage(message) {
    if (!message) return true;
    
    const lowerMessage = message.toLowerCase();
    
    for (const phrase of this.ignorePhrases) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'i');
      if (regex.test(lowerMessage)) {
        return true;
      }
    }
    
    return false;
  }

  async handleChatMessage(data) {
    if (!data.message) return;
    
    if (!data.message.toLowerCase().startsWith(this.command.toLowerCase())) {
      return;
    }
    
    if (this.channelFilters && !this.channelFilters.includes(data.channelType)) {
      logger.verbose(`FlabbyLogsAdminPings: Skipping message in channel type ${data.channelType} (filtered out)`);
      return;
    }
    
    if (this.shouldIgnoreMessage(data.message)) {
      logger.verbose(`FlabbyLogsAdminPings: Ignoring message due to ignore phrase: ${data.message}`);
      return;
    }
    
    let pingContent = '';
    if (this.pingRolesEnabled && this.roles.length > 0) {
      pingContent = this.roles.map(roleId => `<@&${roleId}>`).join(' ');
      logger.verbose(`FlabbyLogsAdminPings: Role ping content: ${pingContent}`);
    }
    
    const requestText = data.message.substring(this.command.length).trim();
    
    const embed = new EmbedBuilder()
      .setTitle(`📢 Admin Help Requested`)
      .setDescription(`**Player needs assistance**\n${requestText}`)
      .setColor(this.embedColor)
      .addFields(
        { name: 'Server', value: this.config.server.name, inline: true },
        { name: 'Player', value: data.playerName, inline: true },
        { name: 'Channel', value: data.channelType, inline: true },
        { name: 'UUID', value: data.playerBiId, inline: false }
      )
      .setFooter({
        text: "Admin Ping - ReforgerJS",
      })
      .setTimestamp();

    try {
      await this.channelOrThread.send({ 
        content: pingContent, 
        embeds: [embed] 
      });
      
      logger.info(`FlabbyLogsAdminPings: Admin help request from ${data.playerName}: ${requestText}`);
      if (pingContent) {
        logger.info(`FlabbyLogsAdminPings: Pinged roles: ${pingContent}`);
      }
    } catch (error) {
      logger.error(`FlabbyLogsAdminPings: Failed to send admin ping: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners("chatMessage");
      this.serverInstance = null;
    }
    this.channelOrThread = null;
    this.discordClient = null;
    logger.info("FlabbyLogsAdminPings: Cleanup completed");
  }
}

module.exports = FlabbyLogsAdminPings;