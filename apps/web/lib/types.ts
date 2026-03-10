export type Role = "student" | "mentor" | "manager" | "admin";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  role: Role;
  email: string;
};
