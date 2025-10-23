import {
  AccountType,
  EntryType,
  InventoryMethod,
  Journal,
  Payable,
  PaymentStatus,
  PaymentType,
  Purchase,
  Receivable,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface RegisForm {
  name: string;
  username: string;
  password: string;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface LoginRes {
  name: string;
  imageUrl: string | null;
  username: string;
  token: string;
  roleUser: string[];
  createdAt: Date;
}

export interface UserRes {
  id: string;
  name: string;
}

export interface TokenPayload {
  userId: string;
  role: string;
}

export interface Role {
  id: string;
  role: string;
}

export interface UserRole {
  id: number;
  userId: string;
  roleId: string;
  role: Role;
}

export interface UserAndRoles {
  id: string;
  name: string;
  imageUrl: string | null;
  username: string;
  password: string;
  token?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  userRoles: UserRole[];
}

export interface ProductForm {
  productCode: string;
  productName: string;
  category: string;
  unit: string;
}

export interface ProductCreate {
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  avgPurchasePrice: number;
  profitMargin: number;
  sellingPrice: number;
  stock: number;
}

export interface ProductUpdate {
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  profitMargin: number; // nominal langsung
}

export interface ProductUpdateTransaction {
  productId: string;
  stock: number;
  avgPurchasePrice: Decimal;
  profitMargin: Decimal;
  sellingPrice: Decimal;
}

export interface SupplierForm {
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}

export interface VatForm {
  vatRate: number;
  effectiveDate: Date;
}

export interface SettingForm {
  inventoryMethod: InventoryMethod;
}

export interface AccountForm {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: EntryType;
  balance: number;
}

export interface AccountUpdateByPurchaseTransaction {
  accountCode: string;
  balance: Decimal;
}

export interface JournalForm {
  date: string | Date;
  description?: string;
  reference?: string;
}

export interface UpdateJournalForm {
  journalId: string;
  date: string | Date;
  description?: string;
  reference?: string;
}

export interface PurchaseForm {
  date: string | Date;
  supplierId: string;
  invoiceNumber: string;
  paymentType: PaymentType;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
  journalId: string;
}

export interface UpdatePurchaseForm {
  purchaseId: string;
  date: Date;
  supplierId: string;
  paymentType: PaymentType;
  invoiceNumber: string;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
}

export interface PurchaseDetailForm {
  purchaseId: string;
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  subtotal: Decimal;
}

export interface InventoryBatchForm {
  productId: string;
  purchaseDate: string | Date;
  quantity: number;
  purchasePrice: Decimal;
  remainingStock: number;
  purchaseDetailId: string;
}

export interface JournalEntryForm {
  journalId: string;
  accountId: string;
  debit: Decimal;
  credit: Decimal;
}

export interface PayableForm {
  journalEntryId: string;
  supplierId: string;
  purchaseId: string;
  amount: Decimal;
  remainingAmount: Decimal;
  dueDate: Date;
  status: PaymentStatus;
}

export interface UpdatePayableForm {
  payableId: string;
  supplierId: string;
  dueDate: Date;
  amount: Decimal;
  remainingAmount: Decimal;
  status: PaymentStatus;
  journalEntryId: string;
}

export interface RecordPayablePaymentForm {
  payableId: string;
  paidAmount: Decimal;
  remainingAmount: Decimal;
  status: PaymentStatus;
}

export interface CustomerForm {
  customerName: string;
  phone: string;
  address: string;
}

export interface SaleForm {
  date: string | Date;
  customerId: string;
  journalId: string;
  invoiceNumber: string;
  paymentType: PaymentType;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
}

export interface SaleDetailForm {
  saleId: string;
  batchId: string;
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  subtotal: Decimal;
}

export interface ReceivableForm {
  journalEntryId: string;
  customerId: string;
  saleId: string;
  amount: Decimal;
  remainingAmount: Decimal;
  dueDate: Date;
  status: PaymentStatus;
}

// types/pagination.ts
export type PaginationResponse<T, K extends string> = {
  [key in K]: T[];
} & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface PurchaseItem {
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  profitMargin: Decimal;
}

export interface UpdatePurchaseDataRelation {
  date: string;
  supplierId: string;
  invoiceNumber: string;
  items: PurchaseItem[];
  vatRateId: string;
  paymentType: PaymentType;
}

export interface PurchaseRequest {
  date: string;
  supplierId: string;
  invoiceNumber: string;
  vatRateId: string;
  items: PurchaseItem[];
  paymentType: PaymentType; // CASH | CREDIT | MIXED
  cashAmount?: Decimal; // opsional
  dueDate?: string; // opsional, wajib jika CREDIT atau MIXED
}

export interface UpdatePurchaseDetail {
  purchaseId: string;
  vatRateId: string;
  items: PurchaseItem[];
}

export interface PurchaseResult {
  purchase: Purchase;
  journal: Journal;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
}

export interface SaleItem {
  productId: string;
  quantity: number;
}

export interface SaleRequest {
  date: string;
  customerId: string;
  invoiceNumber: string;
  vatRateId: string;
  items: SaleItem[];
  paymentType: PaymentType;
  cashAmount?: Decimal;
  dueDate?: string;
}

export interface UpdateSaleForm {
  saleId: string;
  date: string | Date;
  customerId: string;
  invoiceNumber: string;
  paymentType: PaymentType;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
}

export interface UpdateSaleDetail {
  saleId: string;
  vatRateId: string;
  items: SaleItem[];
}

export interface PaymentPayableRequest {
  payableId: string;
  amount: Decimal;
  paymentDate: string;
  method: string;
}

export interface UpdatePaymentPayableRequest {
  amount: Decimal;
  paymentDate: string;
  method: string;
}

export interface PayablePaymentForm {
  payableId: string;
  journalEntryId: string;
  paymentAmount: Decimal;
  paymentDate: Date;
  method: string;
}

export interface PaginatedPayablesResult {
  items: Payable[];
  total: number;
}

export interface ReceivablePaymentRequest {
  receivableId: string;
  amount: Decimal;
  paymentDate: string;
  method: string;
}

export interface ReceivablePaymentForm {
  receivableId: string;
  journalEntryId: string;
  paymentAmount: Decimal;
  paymentDate: Date;
  method: string;
}

export interface RecordReceivablePaymentForm {
  receivableId: string;
  paidAmount: Decimal;
  remainingAmount: Decimal;
  status: PaymentStatus;
}

export interface UpdatePaymentReceivableRequest {
  amount: Decimal;
  paymentDate: string;
  method: string;
}

export interface UpdateReceivablePaymentForm {
  paymentId: string;
  paymentAmount: Decimal;
  paymentDate: Date;
  method: string;
}

export interface PaginatedReceivablesResult {
  items: Receivable[];
  total: number;
}
