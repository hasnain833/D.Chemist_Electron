/**
 * electron/services/printService.cjs
 * Enhanced Port of C# ThermalPrintService using node-thermal-printer.
 */
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const PrintService = {
  async printReceipt(printerOptions, receiptData, storeInfo, template = {}) {
    const { ThermalPrinter, PrinterTypes, CharacterSet } = require("node-thermal-printer");
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Default template fallback
    const tpl = {
      header: template.header || storeInfo.name || "D.CHEMIST",
      subHeader: template.subHeader || "PHARMACY & LABS",
      footer: template.footer || "Thank you for your visit!",
      showGeneric: template.showGeneric !== false,
      showBatch: template.showBatch !== false,
      showExpiry: template.showExpiry === true
    };

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: printerOptions.interface,
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: "-",
      width: 42,
    });

    let logoPath = null;

    try {
      // 0. Handle Logo if exists (base64 to temp file)
      if (storeInfo.logo && storeInfo.logo.startsWith('data:image')) {
        try {
          const base64Data = storeInfo.logo.replace(/^data:image\/\w+;base64,/, "");
          logoPath = path.join(os.tmpdir(), `receipt_logo_${Date.now()}.png`);
          fs.writeFileSync(logoPath, base64Data, 'base64');
          
          printer.alignCenter();
          await printer.printImage(logoPath);
          printer.newLine();
        } catch (logoErr) {
          console.error("Logo printing error:", logoErr);
        }
      }

      // 1. Header
      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.setStyles({ bold: true });
      printer.println(tpl.header.toUpperCase());
      printer.setStyles({ bold: false });
      printer.setTextNormal();
      // printer.println(tpl.subHeader); // User said redundant
      printer.println(storeInfo.address || "");
      printer.println("Ph: " + (storeInfo.phone || ""));
      if (storeInfo.ntn) printer.println("NTN: " + storeInfo.ntn);
      printer.drawLine();

      // 2. Metadata
      printer.alignLeft();
      printer.setTextNormal();
      printer.println(`Bill No: ${receiptData.billNo}`);
      printer.println(`Date: ${new Date(receiptData.saleDate).toLocaleString()}`);
      printer.println(`Customer: ${receiptData.customerName || "Walking Customer"}`);
      printer.drawLine();

      // 3. Items Table
      printer.tableCustom([
        { text: "Item", align: "LEFT", width: 0.5 },
        { text: "Qty", align: "CENTER", width: 0.15 },
        { text: "Price", align: "RIGHT", width: 0.15 },
        { text: "Total", align: "RIGHT", width: 0.2 },
      ]);
      printer.drawLine();

      for (const item of receiptData.items) {
        printer.tableCustom([
          { text: item.medicineName, align: "LEFT", width: 0.5 },
          { text: item.quantity.toString(), align: "CENTER", width: 0.15 },
          { text: Number(item.unitPrice).toFixed(0), align: "RIGHT", width: 0.15 },
          { text: Number(item.subtotal).toFixed(0), align: "RIGHT", width: 0.2 },
        ]);
        
        // Optional Info from Template
        let extra = [];
        if (tpl.showGeneric && item.genericName) extra.push(item.genericName);
        if (tpl.showBatch && item.batchNo) extra.push(`B: ${item.batchNo}`);
        
        if (extra.length > 0) {
          printer.println(`  (${extra.join(", ")})`);
        }
      }
      printer.drawLine();

      // 4. Totals
      printer.alignRight();
      printer.println(`Sub-Total: Rs. ${Number(receiptData.totalAmount).toLocaleString()}`);
      if (receiptData.discountAmount > 0) printer.println(`Discount: Rs. ${Number(receiptData.discountAmount).toLocaleString()}`);
      if (receiptData.taxAmount > 0) printer.println(`Tax: Rs. ${Number(receiptData.taxAmount).toLocaleString()}`);
      
      printer.setStyles({ bold: true });
      printer.setTextSize(1, 1);
      printer.println(`GRAND TOTAL: Rs. ${Number(receiptData.grandTotal).toLocaleString()}`);
      printer.setTextNormal();
      printer.setStyles({ bold: false });
      printer.drawLine();

      // 5. Footer
      printer.alignCenter();
      printer.println(tpl.footer);
      printer.println("Software by D.Chemist");
      
      printer.cut();
      const result = await printer.execute();
      return { success: true, result };
    } catch (err) {
      console.error("Printing error:", err);
      return { success: false, error: err.message };
    } finally {
      // Cleanup temp logo
      if (logoPath && fs.existsSync(logoPath)) {
        try { fs.unlinkSync(logoPath); } catch (e) {}
      }
    }
  },

  justifyLine(printer, label, value, width) {
    const spacesCount = width - label.length - value.length;
    if (spacesCount > 0) {
      printer.println(label + " ".repeat(spacesCount) + value);
    } else {
      printer.println(label + " " + value);
    }
  }
};

module.exports = PrintService;
