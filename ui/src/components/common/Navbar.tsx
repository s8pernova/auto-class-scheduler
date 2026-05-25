import type { ReactNode } from "react";
import { FaStar } from "react-icons/fa";
import { supabase } from "@/clients/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar({ center }: { center?: ReactNode }) {
    const { status, user } = useAuth();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="text-text col-span-full flex justify-between items-center">
            <div className="w-full">Logo</div>
            <div className="w-full flex justify-center">{center}</div>
            <div className="flex gap-4 w-full justify-end">
                {status === "signed_in" ? (
                    <>
                        <button className="text-yellow-500 hover:text-red-700 flex gap-2 items-center">
                            <FaStar />
                            Favorites
                        </button>
                        <div className="text-end">{user?.email}</div>
                        <button
                            className="text-end text-red-500 hover:text-red-700"
                            onClick={handleSignOut}
                        >
                            Sign out
                        </button>
                    </>
                ) : (
                    <div className="text-end opacity-50">Not signed in</div>
                )}
            </div>
        </div>
    );
}
