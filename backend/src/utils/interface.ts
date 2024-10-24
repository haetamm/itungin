export interface RegisForm {
  name: string,
  username: string,
  password: string
}

export interface LoginForm {
  username: string,
  password: string
}

export interface LoginRes {
  name: string,
  imageUrl: string | null,
  username: string,
  token: string; 
  roleUser: string[],
  createdAt: Date 
}

export interface UserRes {
  id: string,
  name: string,
}

export interface TokenPayload {
  userId: string,
  role: string,
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
  roleUser: UserRole[];
}

export interface ProductForm {
  name: string,
  category: string,
  stock: number
}

export interface SupplierForm {
  name: string,
  phone: string,
  email: string,
  address: string
}

export interface CustomerForm {
  name: string,
  phone: string,
  address: string
}