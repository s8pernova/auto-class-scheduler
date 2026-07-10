import type { ReactNode } from "react";
import { FaStar } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/clients/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar({ center }: { center?: ReactNode }) {
    const { status, user } = useAuth();
    const location = useLocation();
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const isKnownUser = status === "signed_in" && !user?.is_anonymous;
    const isFavoritesView =
        location.pathname === "/catalogs/new" &&
        new URLSearchParams(location.search).get("view") === "favorites";

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="text-text col-span-full flex justify-between items-center">
            <div className="w-full">Logo</div>
            <div className="w-full flex justify-center">{center}</div>
            <div className="flex gap-4 w-full justify-end">
                {isKnownUser ? (
                    <>
                        <Link
                            className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                                isFavoritesView
                                    ? "text-yellow-500"
                                    : "text-primary hover:text-yellow-500"
                            }`}
                            to="/catalogs/new?view=favorites"
                        >
                            <FaStar />
                            Favorites
                        </Link>
                        <div className="text-end">{user?.email}</div>
                        <button
                            className="text-end text-red-500 hover:text-red-700"
                            onClick={handleSignOut}
                        >
                            Sign out
                        </button>
                    </>
                ) : (
                    <>
                        {status === "signed_in" && user?.is_anonymous ? (
                            <span className="self-center text-sm opacity-70">
                                Guest session
                            </span>
                        ) : null}
                        <Link
                            className="rounded-md border border-primary/40 px-3 py-1.5 text-sm font-semibold text-primary hover:border-accent hover:text-accent"
                            state={{ from: returnTo }}
                            to="/login"
                        >
                            Sign in
                        </Link>
                        <Link
                            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:brightness-110"
                            state={{ from: returnTo }}
                            to="/signup"
                        >
                            Sign up
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
