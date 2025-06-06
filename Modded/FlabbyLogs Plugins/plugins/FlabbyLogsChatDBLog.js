const mysql = require("mysql2/promise");

class FlabbyLogsChatDBLog {
  constructor(config) {
    this.config = config;
    this.name = "FlabbyLogsChatDBLog Plugin";
    this.isInitialized = false;
    this.serverInstance = null;
    this.serverId = null;
  }

  async prepareToMount(serverInstance) {
    await this.cleanup();
    this.serverInstance = serverInstance;

    try {
      if (
        !this.config.connectors ||
        !this.config.connectors.mysql ||
        !this.config.connectors.mysql.enabled
      ) {
        logger.warn("FlabbyLogsChatDBLog: MySQL connection not enabled in config.");
        return;
      }

      if (!process.mysqlPool) {
        logger.error("FlabbyLogsChatDBLog: MySQL pool not available.");
        return;
      }

      const pluginConfig = this.config.plugins.find(
        (plugin) => plugin.plugin === "FlabbyLogsChatDBLog"
      );
      if (!pluginConfig || !pluginConfig.enabled) {
        logger.warn("FlabbyLogsChatDBLog: Plugin not enabled in config.");
        return;
      }
      
      if (this.config.server && this.config.server.id) {
        this.serverId = this.config.server.id;
        logger.info(`FlabbyLogsChatDBLog: Using server ID: ${this.serverId}`);
      } else {
        logger.warn("FlabbyLogsChatDBLog: No server ID found in config. Using null.");
        this.serverId = null;
      }

      try {
        const connection = await process.mysqlPool.getConnection();
        logger.info("FlabbyLogsChatDBLog: Database connection successful");
        connection.release();
      } catch (error) {
        logger.error(`FlabbyLogsChatDBLog: Database connection test failed: ${error.message}`);
        return;
      }

      await this.setupSchema();
      this.setupEventListeners();
      this.isInitialized = true;
      logger.info("FlabbyLogsChatDBLog initialized successfully");
    } catch (error) {
      logger.error(`Error initializing FlabbyLogsChatDBLog: ${error.message}`);
    }
  }

  async setupSchema() {
    try {
      const connection = await process.mysqlPool.getConnection();
      
      await this.ensureServerColumn(connection, 'flabbylogs_chatmessages');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS flabbylogs_chatmessages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          serverId INT NULL,
          playerBiId VARCHAR(255) NOT NULL,
          channelId VARCHAR(50) NOT NULL,
          channelType VARCHAR(50) NOT NULL,
          playerName VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          serverName VARCHAR(255) NULL,
          senderFaction VARCHAR(255) NULL,
          senderId VARCHAR(50) NULL
        )
      `);
      logger.info("FlabbyLogsChatDBLog: flabbylogs_chatmessages table verified");
      
      connection.release();
      logger.info("FlabbyLogsChatDBLog: Schema setup completed");
    } catch (error) {
      logger.error(`Error setting up schema: ${error.message}`);
      throw error;
    }
  }
  
  async ensureServerColumn(connection, tableName) {
    try {
      const [tables] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`, 
        [tableName]
      );
      
      if (tables[0].count === 0) {
        return;
      }
      
      const [columns] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.columns 
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'serverId'`,
        [tableName]
      );
      
      if (columns[0].count === 0) {
        await connection.query(
          `ALTER TABLE ${tableName} ADD COLUMN serverId INT NULL AFTER created_at`
        );
        logger.info(`FlabbyLogsChatDBLog: Added 'serverId' column to ${tableName} table`);
      }
    } catch (error) {
      logger.error(`Error ensuring server column for ${tableName}: ${error.message}`);
    }
  }

  setupEventListeners() {
    this.serverInstance.on("chatMessage", (data) => {
      logger.verbose(`FlabbyLogsChatDBLog: Received chatMessage event: ${JSON.stringify(data)}`);
      this.logChatMessage(data);
    });
    
    logger.info("FlabbyLogsChatDBLog: Event listeners set up");
  }

  async logChatMessage(data) {
    if (!this.isInitialized) {
      logger.warn("FlabbyLogsChatDBLog: Attempted to log chat message but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`FlabbyLogsChatDBLog: Logging chat message - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        `INSERT INTO flabbylogs_chatmessages 
         (serverId, playerBiId, channelId, channelType, playerName, message, serverName, senderFaction, senderId) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.serverId,
          data.playerBiId,
          data.channelId,
          data.channelType,
          data.playerName,
          data.message,
          data.serverName || this.config.server.name,
          data.senderFaction,
          data.senderId
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`FlabbyLogsChatDBLog: Chat message logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`FlabbyLogsChatDBLog: Chat message logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`FlabbyLogsChatDBLog: Error logging chat message: ${error.message}`);
      if (error.stack) {
        logger.error(`FlabbyLogsChatDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async cleanup() {
    this.isInitialized = false;
    logger.info("FlabbyLogsChatDBLog: Cleanup completed");
  }
}

module.exports = FlabbyLogsChatDBLog;