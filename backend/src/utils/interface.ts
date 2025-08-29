import {
  Account,
  AccountType,
  EntryType,
  InventoryMethod,
  Journal,
  PaymentStatus,
  PaymentType,
  Purchase,
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
  token: string;
  userRoles: string[];
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
}

export interface ProductCreate {
  productCode: string;
  productName: string;
  category: string;
  avgPurchasePrice: number;
  profitMargin: number;
  sellingPrice: number;
  stock: number;
}

export interface ProductUpdate {
  productCode: string;
  productName: string;
  category: string;
  profitMargin: number; // nominal langsung
}

export interface ProductUpdateByPurchaseTransaction {
  productId: string;
  stock: number;
  avgPurchasePrice: Decimal;
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

export interface PurchaseDetailForm {
  purchaseId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InventoryBatchForm {
  productId: string;
  purchaseDate: string | Date;
  quantity: number;
  purchasePrice: number;
  remainingStock: number;
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
  dueDate: Date;
  status: PaymentStatus;
}

export interface CustomerForm {
  customerName: string;
  phone: string;
  address: string;
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
  unitPrice: number;
}

export interface CreatePurchase {
  date: string;
  supplierId: string;
  invoiceNumber: string;
  items: PurchaseItem[];
  vatRateId: string;
  inventoryAccountCode: string;
  vatInputAccountCode: string;
  paymentType: PaymentType;
}

export interface PurchaseResult {
  purchase: Purchase;
  journal: Journal;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
  inventoryAccount: Account;
  vatInputAccount: Account;
}

export interface CashPurchaseRequest {
  date: string;
  supplierId: string;
  invoiceNumber: string;
  vatRateId: string;
  items: PurchaseItem[];
  cashAccountCode: string;
  inventoryAccountCode: string;
  vatInputAccountCode: string;
}

export interface CreditPurchaseRequest {
  date: string;
  supplierId: string;
  invoiceNumber: string;
  vatRateId: string;
  items: PurchaseItem[];
  payableAccountCode: string;
  inventoryAccountCode: string;
  vatInputAccountCode: string;
}

export interface MixedPurchaseRequest {
  date: string;
  supplierId: string;
  invoiceNumber: string;
  vatRateId: string;
  items: PurchaseItem[];
  cashAccountCode: string;
  cashAmount: Decimal;
  payableAccountCode: string;
  inventoryAccountCode: string;
  vatInputAccountCode: string;
}
