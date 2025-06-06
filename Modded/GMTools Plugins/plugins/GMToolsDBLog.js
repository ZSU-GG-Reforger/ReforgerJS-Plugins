const mysql = require("mysql2/promise");

class GMToolsDBLog {
  constructor(config) {
    this.config = config;
    this.name = "GMToolsDBLog Plugin";
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
        logger.warn("GMToolsDBLog: MySQL connection not enabled in config.");
        return;
      }

      if (!process.mysqlPool) {
        logger.error("GMToolsDBLog: MySQL pool not available.");
        return;
      }

      const pluginConfig = this.config.plugins.find(
        (plugin) => plugin.plugin === "GMToolsDBLog"
      );
      if (!pluginConfig || !pluginConfig.enabled) {
        logger.warn("GMToolsDBLog: Plugin not enabled in config.");
        return;
      }
      
      if (this.config.server && this.config.server.id) {
        this.serverId = this.config.server.id;
        logger.info(`GMToolsDBLog: Using server ID: ${this.serverId}`);
      } else {
        logger.warn("GMToolsDBLog: No server ID found in config. Using null.");
        this.serverId = null;
      }

      try {
        const connection = await process.mysqlPool.getConnection();
        logger.info("GMToolsDBLog: Database connection successful");
        connection.release();
      } catch (error) {
        logger.error(`GMToolsDBLog: Database connection test failed: ${error.message}`);
        return;
      }

      await this.setupSchema();
      this.setupEventListeners();
      this.isInitialized = true;
      logger.info("GMToolsDBLog initialized successfully");
    } catch (error) {
      logger.error(`Error initializing GMToolsDBLog: ${error.message}`);
    }
  }

  async setupSchema() {
    try {
      const connection = await process.mysqlPool.getConnection();
      
      await this.ensureServerColumn(connection, 'gmtools_status');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS gmtools_status (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          server INT NULL,
          playerName VARCHAR(255) NOT NULL,
          playerId VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL
        )
      `);
      logger.info("GMToolsDBLog: gmtools_status table verified");
      
      await this.ensureServerColumn(connection, 'gmtools_duration');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS gmtools_duration (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          server INT NULL,
          playerName VARCHAR(255) NOT NULL,
          playerId VARCHAR(50) NOT NULL,
          duration FLOAT NOT NULL
        )
      `);
      logger.info("GMToolsDBLog: gmtools_duration table verified");
      
      connection.release();
      logger.info("GMToolsDBLog: Schema setup completed");
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
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'server'`,
        [tableName]
      );
      
      if (columns[0].count === 0) {
        await connection.query(
          `ALTER TABLE ${tableName} ADD COLUMN server INT NULL AFTER created_at`
        );
        logger.info(`GMToolsDBLog: Added 'server' column to ${tableName} table`);
      }
    } catch (error) {
      logger.error(`Error ensuring server column for ${tableName}: ${error.message}`);
    }
  }

  setupEventListeners() {
    this.serverInstance.on("gmToolsStatus", (data) => {
      logger.verbose(`GMToolsDBLog: Received gmToolsStatus event: ${JSON.stringify(data)}`);
      this.logGMToolsStatus(data);
    });
    
    this.serverInstance.on("gmToolsTime", (data) => {
      logger.verbose(`GMToolsDBLog: Received gmToolsTime event: ${JSON.stringify(data)}`);
      this.logGMToolsDuration(data);
    });
    
    logger.info("GMToolsDBLog: Event listeners set up");
  }

  async logGMToolsStatus(data) {
    if (!this.isInitialized) {
      logger.warn("GMToolsDBLog: Attempted to log GM tools status but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`GMToolsDBLog: Logging GM tools status - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        "INSERT INTO gmtools_status (server, playerName, playerId, status) VALUES (?, ?, ?, ?)",
        [
          this.serverId,
          data.playerName,
          data.playerId,
          data.status
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`GMToolsDBLog: GM tools status logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`GMToolsDBLog: GM tools status logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`GMToolsDBLog: Error logging GM tools status: ${error.message}`);
      if (error.stack) {
        logger.error(`GMToolsDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async logGMToolsDuration(data) {
    if (!this.isInitialized) {
      logger.warn("GMToolsDBLog: Attempted to log GM tools duration but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`GMToolsDBLog: Logging GM tools duration - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        "INSERT INTO gmtools_duration (server, playerName, playerId, duration) VALUES (?, ?, ?, ?)",
        [
          this.serverId,
          data.playerName,
          data.playerId,
          data.duration
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`GMToolsDBLog: GM tools duration logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`GMToolsDBLog: GM tools duration logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`GMToolsDBLog: Error logging GM tools duration: ${error.message}`);
      if (error.stack) {
        logger.error(`GMToolsDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async cleanup() {
    this.isInitialized = false;
    logger.info("GMToolsDBLog: Cleanup completed");
  }
}

module.exports = GMToolsDBLog;