import { createContext, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "booting" | "signed_out" | "signed_in" | "error";

export interface AuthContextValue {
    status: AuthStatus;
    setStatus: Dispatch<SetStateAction<AuthStatus>>;
    session: Session | null;
    user: User | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
