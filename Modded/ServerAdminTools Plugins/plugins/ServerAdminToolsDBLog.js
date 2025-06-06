const mysql = require("mysql2/promise");

class ServerAdminToolsDBLog {
  constructor(config) {
    this.config = config;
    this.name = "ServerAdminToolsDBLog Plugin";
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
        logger.warn("ServerAdminToolsDBLog: MySQL connection not enabled in config.");
        return;
      }

      if (!process.mysqlPool) {
        logger.error("ServerAdminToolsDBLog: MySQL pool not available.");
        return;
      }

      const pluginConfig = this.config.plugins.find(
        (plugin) => plugin.plugin === "ServerAdminToolsDBLog"
      );
      if (!pluginConfig || !pluginConfig.enabled) {
        logger.warn("ServerAdminToolsDBLog: Plugin not enabled in config.");
        return;
      }
      
      if (this.config.server && this.config.server.id) {
        this.serverId = this.config.server.id;
        logger.info(`ServerAdminToolsDBLog: Using server ID: ${this.serverId}`);
      } else {
        logger.warn("ServerAdminToolsDBLog: No server ID found in config. Using null.");
        this.serverId = null;
      }

      try {
        const connection = await process.mysqlPool.getConnection();
        logger.info("ServerAdminToolsDBLog: Database connection successful");
        connection.release();
      } catch (error) {
        logger.error(`ServerAdminToolsDBLog: Database connection test failed: ${error.message}`);
        return;
      }

      await this.setupSchema();
      await this.migrateSchema();
      
      this.setupEventListeners();
      this.isInitialized = true;
      logger.info("ServerAdminToolsDBLog initialized successfully");
    } catch (error) {
      logger.error(`Error initializing ServerAdminToolsDBLog: ${error.message}`);
    }
  }

  async setupSchema() {
    try {
      const connection = await process.mysqlPool.getConnection();
      
      await this.ensureServerColumn(connection, 'sat_player_killed');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sat_player_killed (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          server INT NULL,
          playerName VARCHAR(255) NOT NULL,
          instigatorName VARCHAR(255) NOT NULL,
          friendlyFire BOOLEAN NOT NULL,
          isAI BOOLEAN NOT NULL
        )
      `);
      logger.info("ServerAdminToolsDBLog: sat_player_killed table verified");
      
      await this.ensureServerColumn(connection, 'sat_base_capture');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sat_base_capture (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          server INT NULL,
          faction VARCHAR(255) NOT NULL,
          base VARCHAR(255) NOT NULL
        )
      `);
      logger.info("ServerAdminToolsDBLog: sat_base_capture table verified");
      
      await this.ensureServerColumn(connection, 'sat_admin_action');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sat_admin_action (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          server INT NULL,
          action VARCHAR(50) NOT NULL,
          admin VARCHAR(255) NOT NULL,
          target VARCHAR(255) NOT NULL
        )
      `);
      logger.info("ServerAdminToolsDBLog: sat_admin_action table verified");
      
      await this.ensureServerColumn(connection, 'sat_game_end');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sat_game_end (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          server INT NULL,
          reason VARCHAR(100) NOT NULL,
          winner VARCHAR(255) NOT NULL
        )
      `);
      logger.info("ServerAdminToolsDBLog: sat_game_end table verified");
      
      connection.release();
      logger.info("ServerAdminToolsDBLog: Schema setup completed");
    } catch (error) {
      logger.error(`Error setting up schema: ${error.message}`);
      throw error;
    }
  }
  
async migrateSchema() {
    try {
      const connection = await process.mysqlPool.getConnection();
      
      const tables = [
        'sat_player_killed',
        'sat_base_capture', 
        'sat_admin_action',
        'sat_game_end'
      ];
      
      for (const tableName of tables) {
        await this.migrateTableToUtf8mb4(connection, tableName);
      }
      
      connection.release();
    } catch (error) {
      logger.error(`ServerAdminToolsDBLog: Error during schema migration: ${error.message}`);
      throw error;
    }
  }
  
  async migrateTableToUtf8mb4(connection, tableName) {
    try {
      const [tableExists] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
      );
      
      if (tableExists[0].count === 0) {
        return;
      }
      
      const [tableInfo] = await connection.query(
        `SELECT table_collation FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
      );
      
      const currentCollation = tableInfo[0].table_collation;
      
      if (currentCollation && currentCollation.startsWith('utf8mb4_')) {
        return;
      }
      
      logger.info(`ServerAdminToolsDBLog: Migrating table ${tableName} to utf8mb4...`);
      
      await connection.query(
        `ALTER TABLE ${tableName} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      
    } catch (error) {
      logger.error(`ServerAdminToolsDBLog: Error migrating table ${tableName}: ${error.message}`);
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
        logger.info(`ServerAdminToolsDBLog: Added 'server' column to ${tableName} table`);
      }
    } catch (error) {
      logger.error(`Error ensuring server column for ${tableName}: ${error.message}`);
    }
  }

  setupEventListeners() {
    // Player killed event
    this.serverInstance.on("satPlayerKilled", (data) => {
      logger.verbose(`ServerAdminToolsDBLog: Received satPlayerKilled event: ${JSON.stringify(data)}`);
      this.logPlayerKilled(data);
    });
    
    // Base capture event
    this.serverInstance.on("baseCapture", (data) => {
      logger.verbose(`ServerAdminToolsDBLog: Received baseCapture event: ${JSON.stringify(data)}`);
      this.logBaseCapture(data);
    });
    
    // Admin action event
    this.serverInstance.on("adminAction", (data) => {
      logger.verbose(`ServerAdminToolsDBLog: Received adminAction event: ${JSON.stringify(data)}`);
      this.logAdminAction(data);
    });
    
    // Game end event
    this.serverInstance.on("satGameEnd", (data) => {
      logger.verbose(`ServerAdminToolsDBLog: Received satGameEnd event: ${JSON.stringify(data)}`);
      this.logGameEnd(data);
    });
    
    logger.info("ServerAdminToolsDBLog: Event listeners set up");
  }

  async logPlayerKilled(data) {
    if (!this.isInitialized) {
      logger.warn("ServerAdminToolsDBLog: Attempted to log player kill but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`ServerAdminToolsDBLog: Logging player kill - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        "INSERT INTO sat_player_killed (server, playerName, instigatorName, friendlyFire, isAI) VALUES (?, ?, ?, ?, ?)",
        [
          this.serverId,
          data.playerName,
          data.instigatorName,
          data.friendlyFire ? 1 : 0,
          data.isAI ? 1 : 0
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`ServerAdminToolsDBLog: Player kill logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`ServerAdminToolsDBLog: Player kill logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`ServerAdminToolsDBLog: Error logging player kill: ${error.message}`);
      if (error.stack) {
        logger.error(`ServerAdminToolsDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async logBaseCapture(data) {
    if (!this.isInitialized) {
      logger.warn("ServerAdminToolsDBLog: Attempted to log base capture but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`ServerAdminToolsDBLog: Logging base capture - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        "INSERT INTO sat_base_capture (server, faction, base) VALUES (?, ?, ?)",
        [
          this.serverId,
          data.faction,
          data.base
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`ServerAdminToolsDBLog: Base capture logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`ServerAdminToolsDBLog: Base capture logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`ServerAdminToolsDBLog: Error logging base capture: ${error.message}`);
      if (error.stack) {
        logger.error(`ServerAdminToolsDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async logAdminAction(data) {
    if (!this.isInitialized) {
      logger.warn("ServerAdminToolsDBLog: Attempted to log admin action but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`ServerAdminToolsDBLog: Logging admin action - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        "INSERT INTO sat_admin_action (server, action, admin, target) VALUES (?, ?, ?, ?)",
        [
          this.serverId,
          data.action,
          data.adminName,
          data.targetPlayer
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`ServerAdminToolsDBLog: Admin action logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`ServerAdminToolsDBLog: Admin action logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`ServerAdminToolsDBLog: Error logging admin action: ${error.message}`);
      if (error.stack) {
        logger.error(`ServerAdminToolsDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async logGameEnd(data) {
    if (!this.isInitialized) {
      logger.warn("ServerAdminToolsDBLog: Attempted to log game end but plugin not initialized");
      return;
    }
    
    try {
      logger.verbose(`ServerAdminToolsDBLog: Logging game end - ${JSON.stringify(data)}`);
      
      const [result] = await process.mysqlPool.query(
        "INSERT INTO sat_game_end (server, reason, winner) VALUES (?, ?, ?)",
        [
          this.serverId,
          data.reason,
          data.winner
        ]
      );
      
      if (result && result.affectedRows > 0) {
        logger.verbose(`ServerAdminToolsDBLog: Game end logged successfully. ID: ${result.insertId}`);
      } else {
        logger.warn(`ServerAdminToolsDBLog: Game end logging did not affect any rows`);
      }
    } catch (error) {
      logger.error(`ServerAdminToolsDBLog: Error logging game end: ${error.message}`);
      if (error.stack) {
        logger.error(`ServerAdminToolsDBLog: Error stack: ${error.stack}`);
      }
    }
  }

  async cleanup() {
    this.isInitialized = false;
    logger.info("ServerAdminToolsDBLog: Cleanup completed");
  }
}

module.exports = ServerAdminToolsDBLog;