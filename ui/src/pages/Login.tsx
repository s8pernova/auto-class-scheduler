import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/clients/supabaseClient";

type FormStatus = "idle" | "loading" | "success" | "error";

function Login() {
    const [status, setStatus] = useState<FormStatus>("idle");
    const [message, setMessage] = useState("");

    const isLoading = status === "loading";

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setStatus("loading");
        setMessage("");

        const formData = new FormData(e.currentTarget);

        const email = String(formData.get("email") ?? "")
            .trim()
            .toLowerCase();

        const password = String(formData.get("password") ?? "");

        if (!email) {
            setStatus("error");
            setMessage("Enter an email address.");
            return;
        }

        if (!password) {
            setStatus("error");
            setMessage("Enter a password.");
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("Login failed:", error);
            setStatus("error");
            setMessage(
                "Could not sign in. Check your email and password, then try again.",
            );
            return;
        }

        setStatus("success");
        setMessage("Signed in successfully.");

        e.currentTarget.reset();
    };

    return (
        <div className="bg-white space-y-5">
            <div>Login Page</div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <input
                    className="border-1"
                    name="email"
                    type="email"
                    placeholder="Email"
                    autoComplete="email"
                    required
                    disabled={isLoading}
                />

                <input
                    className="border-1"
                    name="password"
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                />

                <button type="submit" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Log In"}
                </button>
            </form>

            <Link to="/signup">No account? Sign up here.</Link>

            {message && (
                <p role={status === "error" ? "alert" : "status"}>{message}</p>
            )}
        </div>
    );
}

export default Login;
