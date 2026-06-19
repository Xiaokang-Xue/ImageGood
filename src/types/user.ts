export interface PublicUser {
  id: string;
  email: string | null;
  phone?: string | null;
  name: string;
  avatar?: string | null;
  credits: number;
  role: "user" | "admin";
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt?: string | null;
  hasVerifiedContact: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  message?: string;
}
