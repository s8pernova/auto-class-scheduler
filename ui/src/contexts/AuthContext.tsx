import { createContext, Dispatch, ReactNode, SetStateAction, useState, useContext } from "react";

export type AuthStatus = "booting" | "signed_out" | "signed_in" | "error";

interface AuthContextType {
    status: AuthStatus;
    setStatus: Dispatch<SetStateAction<AuthStatus>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>("booting");

    return (
        <AuthContext.Provider value={{ status, setStatus }}>
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