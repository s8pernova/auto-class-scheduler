import { supabase } from "@/clients/supabaseClient";

function SignUp() {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const email = (
            e.currentTarget.elements.namedItem("email") as HTMLInputElement
        ).value;
        const password = (
            e.currentTarget.elements.namedItem("password") as HTMLInputElement
        ).value;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            console.error("Error signing up:", error);
        } else {
            console.log("User signed up:", data);
        }
    };

    return (
        <div className="bg-orange-400 space-y-5">
            <div>Sign Up Page</div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    className="p-2 rounded border"
                />
                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                    className="p-2 rounded border"
                />
                <button
                    type="submit"
                    className="p-2 bg-blue-500 text-white rounded"
                >
                    Sign Up
                </button>
            </form>
        </div>
    );
}

export default SignUp;
