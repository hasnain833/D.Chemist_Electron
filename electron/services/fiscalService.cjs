/**
 * electron/services/fiscalService.cjs
 * Port of C# FiscalService for FBR Pakistan API integration.
 */
const { net } = require('electron');

const FiscalService = {
  async generateFiscalQrData(billNo, amount, tax, fbrInvoiceNo, posId = "DChemist-001") {
    const dt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return `POSID:${posId}|USIN:${billNo}|FBR_INV:${fbrInvoiceNo}|AMT:${parseFloat(amount).toFixed(2)}|TAX:${parseFloat(tax).toFixed(2)}|DT:${dt}`;
  },

  async reportSale(saleData, settings) {
    const isLive = settings.fbr_is_live === 'true';
    if (!isLive) {
      return this.runSimulator(saleData.billNo);
    }

    return new Promise((resolve, reject) => {
      const apiUrl = settings.fbr_api_url;
      const posId  = settings.fbr_pos_id;
      const token  = settings.fbr_token;

      if (!apiUrl) return resolve({ success: false, error: "FBR API URL not configured." });

      const payload = {
        InvoiceNumber: "", 
        POSID: parseInt(posId),
        USIN: saleData.billNo,
        DateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
        BuyerName: saleData.customerName || "Customer",
        BuyerNTN: settings.pharmacy_ntn || "",
        TotalBillAmount: parseFloat(saleData.grandTotal),
        TotalTaxAmount: parseFloat(saleData.taxAmount),
        TotalQuantity: saleData.items.reduce((sum, i) => sum + i.quantity, 0),
        PaymentMode: 1, // Cash
        InvoiceType: 1, // New
        Items: saleData.items.map(i => ({
          ItemCode: i.medicineId?.toString() || "000",
          ItemName: i.medicineName,
          PCTCode: "3004.9099", 
          Quantity: i.quantity,
          TaxRate: 0.0,
          SaleValue: parseFloat(i.subtotal),
          TaxAmount: 0.0,
          Discount: 0.0
        }))
      };

      const request = net.request({
        method: 'POST',
        url: apiUrl,
      });

      request.setHeader('Content-Type', 'application/json');
      if (token) {
        request.setHeader('Authorization', `Bearer ${token}`);
      }

      request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              const result = JSON.parse(body);
              resolve({
                success: true,
                invoiceNumber: result.InvoiceNumber || saleData.billNo,
                responseRaw: body
              });
            } catch (e) {
              resolve({ success: true, invoiceNumber: saleData.billNo, responseRaw: body });
            }
          } else {
            resolve({
              success: false,
              error: `FBR API Error (${response.statusCode}): ${body}`
            });
          }
        });
      });

      request.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      request.write(JSON.stringify(payload));
      request.end();
    });
  },

  async runSimulator(billNo) {
    await new Promise(r => setTimeout(r, 500));
    const fbrNo = `SIM-FBR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).substring(2,10).toUpperCase()}`;
    return {
      success: true,
      invoiceNumber: fbrNo,
      responseRaw: JSON.stringify({ status: "simulator", invoice_no: fbrNo })
    };
  }
};

module.exports = FiscalService;
