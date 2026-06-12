/**
 * electron/services/backupService.cjs
 * Port of C# BackupService. Uses child_process to spawn pg_dump.exe.
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const BackupService = {
  /**
   * Generates a database backup using pg_dump. 
   * Reads target database credentials from the passed `dbCfg`.
   * Fixes hardcoded C# bug by using dynamic DB connections.
   */
  async createBackup(dbCfg, outputDirPath) {
    return new Promise((resolve, reject) => {
      // Basic safeguard for pg_dump execution path (Assuming pg_dump is in Windows PATH or defined in env var)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `backup_${dbCfg.database}_${timestamp}.sql`;
      const outputPath = path.join(outputDirPath, backupFilename);

      // Environment variables for pg_dump to avoid password prompt
      const env = {
        ...process.env,
        PGPASSWORD: dbCfg.password
      };

      // Construct pg_dump command argument string
      const cmd = `pg_dump -U ${dbCfg.user} -h ${dbCfg.host} -p ${dbCfg.port} -d ${dbCfg.database} -f "${outputPath}"`;

      exec(cmd, { env }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[BackupService] exec error: ${error}`);
          return resolve({ success: false, message: error.message, error });
        }
        
        // Also verify the file was actually written and > 0 bytes
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            resolve({ success: true, filePath: outputPath });
          } else {
            resolve({ success: false, message: 'Backup file generated but is 0 bytes.' });
          }
        } else {
          resolve({ success: false, message: 'Backup file was not created.' });
        }
      });
    });
  },

  /**
   * Restores a database backup from a .sql file using psql.
   */
  async restoreBackup(dbCfg, backupFilePath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(backupFilePath)) {
        return resolve({ success: false, message: 'Backup file does not exist.' });
      }

      // Environment variables for psql to avoid password prompt
      const env = {
        ...process.env,
        PGPASSWORD: dbCfg.password
      };

      // Construct psql command string
      const cmd = `psql -U ${dbCfg.user} -h ${dbCfg.host} -p ${dbCfg.port} -d ${dbCfg.database} -f "${backupFilePath}"`;

      exec(cmd, { env }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[BackupService] restore error: ${error}`);
          return resolve({ success: false, message: error.message, error });
        }
        resolve({ success: true });
      });
    });
  }
};

module.exports = BackupService;

