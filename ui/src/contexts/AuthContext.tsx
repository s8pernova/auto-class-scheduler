import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/clients/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import {
    AuthContext,
    type AuthStatus,
} from "@/contexts/authContextValue";

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
