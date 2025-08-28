import { AccountType, EntryType, InventoryMethod } from '@prisma/client';

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
