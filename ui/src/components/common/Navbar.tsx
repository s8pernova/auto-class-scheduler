import type { ReactNode } from "react";
import { FaStar } from "react-icons/fa";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import { supabase } from "@/clients/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar({ center }: { center?: ReactNode }) {
    const { status, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isResultsView = useMatch("/catalogs/:catalogId/results") !== null;
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const isKnownUser = status === "signed_in" && !user?.is_anonymous;
    const isFavoritesView =
        new URLSearchParams(location.search).get("favorites") === "true";

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleFavoritesToggle = () => {
        const nextSearchParams = new URLSearchParams(location.search);

        if (isFavoritesView) {
            nextSearchParams.delete("favorites");
        } else {
            nextSearchParams.set("favorites", "true");
        }

        const search = nextSearchParams.toString();
        navigate(
            {
                pathname: location.pathname,
                search: search ? `?${search}` : "",
                hash: location.hash,
            },
            { replace: true },
        );
    };

    return (
        <div className="text-text col-span-full flex justify-between items-center">
            <div className="w-full">Logo</div>
            <div className="w-full flex justify-center">{center}</div>
            <div className="flex gap-4 w-full justify-end">
                {isKnownUser ? (
                    <>
                        {isResultsView ? (
                            <button
                                type="button"
                                aria-pressed={isFavoritesView}
                                onClick={handleFavoritesToggle}
                                className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                                    isFavoritesView
                                        ? "text-yellow-500"
                                        : "text-primary hover:text-yellow-500"
                                }`}
                            >
                                <FaStar />
                                Favorites
                            </button>
                        ) : null}
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
