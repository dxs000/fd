import type { Role } from "../../generated/prisma/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
};


declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};