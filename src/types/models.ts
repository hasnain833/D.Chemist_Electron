export interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  status: string;
  mustChangePassword?: boolean;
}

export interface Customer {
  id: number;
  customerName: string;
  fullName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  createdAt: Date;
}

export interface Category {
  id: number;
  name: string;
  createdAt: Date;
}

export interface Manufacturer {
  id: number;
  name: string;
  createdAt: Date;
}

export interface Medicine {
  id: number;
  name: string;
  genericName?: string;
  categoryId?: number;
  categoryName?: string;
  manufacturerId?: number;
  manufacturerName?: string;
  dosageForm?: string;
  batchNo?: string;
  strength?: string;
  barcode?: string;
  gstPercent: number;
  stockQty: number;
  sellingPrice: number;
  expiryDate?: Date;
  createdAt: Date;
}

export interface InventoryBatch {
  id: number;
  medicineId: number;
  supplierId?: number;
  batchNo: string;
  quantityUnits: number;
  purchaseTotalPrice: number;
  unitCost: number;
  sellingPrice: number;
  remainingUnits: number;
  manufactureDate?: Date;
  expiryDate: Date;
  invoiceNo: string;
  invoiceDate?: Date;
  createdAt: Date;

  // Joined from supplier table
  supplierName?: string;
}

export interface Sale {
  id: number;
  billNo: string;
  userId: number;
  customerId?: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  saleDate: Date;
  status: string;

  // Joined fields
  cashierName?: string;
  customerName?: string;

  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  saleId: number;
  medicineId?: number;
  batchId?: number;
  medicineName: string;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface AuditLog {
  id: number;
  userId: number;
  username?: string;
  action: string;
  details: string;
  createdAt: Date;
}

export interface FinancialReport {
  reportDate: Date;
  grossSales: number;
  totalTax: number;
  totalDiscount: number;
  totalReturns: number;
  netSales: number;
  totalSalesCount: number;
  returnsCount: number;
}

export interface DashboardStats {
  todaySalesTotal: number;
  todaySalesCount: number;
  monthlySalesTotal: number;
  totalMedicines: number;
  lowStockCount: number;
  expiringSoonCount: number;
}
