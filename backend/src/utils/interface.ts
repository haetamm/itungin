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
    username: string,
    token: string; 
    roleUser: string[] 
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
    username: string;
    password: string;
    token?: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    roleUser: UserRole[];
  }
  