export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  credits: number;
  role: "user" | "admin";
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  message?: string;
}
