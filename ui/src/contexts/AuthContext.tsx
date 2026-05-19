import { createContext, Dispatch, ReactNode, SetStateAction, useState, useContext, useEffect } from "react";
import { supabase } from "@/clients/supabaseClient";
import { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "booting" | "signed_out" | "signed_in" | "error";

interface AuthContextType {
    status: AuthStatus;
    setStatus: Dispatch<SetStateAction<AuthStatus>>;
    session: Session | null;
    user: User | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>("booting");
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Fetch current session on boot
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setStatus(session ? "signed_in" : "signed_out");
        }).catch(() => {
            setStatus("error");
        });

        // Listen for auth changes (login, logout, token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setStatus(session ? "signed_in" : "signed_out");
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ status, setStatus, session, user }}>
            {children}
        </AuthContext.Provider>
    );
}

// Helpers

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}