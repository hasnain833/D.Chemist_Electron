export interface PurchaseInvoice {
  id: number;
  invoice_no: string;
  supplier_id: number | null;
  supplier_name: string;
  invoice_date: string;
  total_amount: number | string; // pg may return numeric as string
  status: string;
  created_at: string;
}

export interface InvoiceBatchItem {
  id: number;
  medicine_id: number;
  medicine_name: string;
  supplier_id: number | null;
  batch_no: string;
  quantity_units: number;
  purchase_total_price: number | string;
  unit_cost: number | string;
  selling_price: number | string;
  remaining_units: number;
  manufacture_date: string | null;
  expiry_date: string;
  invoice_no: string;
  invoice_date: string;
  entry_mode: string;
  units_per_pack: number;
  pack_quantity: number;
  purchase_invoice_id: number;
  packets_per_box: number;
}

export interface EditableInvoiceItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  entryMode: string;
  packetsPerBox: number;
  unitsPerPack: number;

  originalBatchNo: string;
  originalQuantityUnits: number;
  originalRemainingUnits: number;
  originalTotalCost: number;
  originalPackQuantity: number;

  editBatchNo: string;
  editQuantityText: string;
  editTotalCostText: string;

  editPackQuantity: number;
  editTotalUnits: number;
  editTotalCost: number;
  editUnitCost: number;
}
