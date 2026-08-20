export type UserRole = 'Admin' | 'Owner' | 'User';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
