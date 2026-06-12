/**
 * electron/services/reportingService.cjs
 * Port of C# ReportingService - Native CSV exporting using dialog.showSaveDialog.
 */
const { dialog } = require('electron');
const fs = require('fs');

const ReportingService = {
  /**
   * Prompts the user to select a location and writes CSV content.
   */
  async exportToCSV(focusedWindow, suggestedName, csvContent) {
    const result = await dialog.showSaveDialog(focusedWindow, {
      title: 'Export CSV Report',
      defaultPath: suggestedName,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Export cancelled.' };
    }

    try {
      // Write file with UTF-8 encoding
      fs.writeFileSync(result.filePath, csvContent, 'utf8');
      return { success: true, filePath: result.filePath };
    } catch (err) {
      console.error('[ReportingService] Failed to write CSV file:', err);
      return { success: false, message: err.message };
    }
  }
};

module.exports = ReportingService;
