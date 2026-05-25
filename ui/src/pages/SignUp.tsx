import { useState } from "react";
import { supabase } from "@/clients/supabaseClient";

type FormStatus = "idle" | "loading" | "success" | "error";

function getEmailRedirectUrl() {
    return `${window.location.origin}/auth/callback`;
}

function SignUp() {
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

        if (password.length < 8) {
            setStatus("error");
            setMessage("Password must be at least 8 characters.");
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: getEmailRedirectUrl(),
            },
        });

        if (error) {
            console.error("Sign up failed:", error);
            setStatus("error");
            setMessage(
                "Could not create account. Check your email and password, then try again.",
            );
            return;
        }

        setStatus("success");

        if (data.session) {
            setMessage("Account created. You are signed in.");
        } else {
            setMessage("Check your email to confirm your account.");
        }

        e.currentTarget.reset();
    };

    return (
        <div className="bg-white space-y-5">
            <div>Sign Up Page</div>

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
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={isLoading}
                />

                <button type="submit" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Sign Up"}
                </button>
            </form>

            {message && (
                <p role={status === "error" ? "alert" : "status"}>{message}</p>
            )}
        </div>
    );
}

export default SignUp;
