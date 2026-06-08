import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getSharedCatalog } from "@/api";

type LoadState = "loading" | "not_found" | "error";

export default function SharedCatalogPage() {
    const { shareSlug } = useParams<{ shareSlug: string }>();
    const navigate = useNavigate();
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!shareSlug) {
            setLoadState("not_found");
            return;
        }

        let isCurrent = true;
        setLoadState("loading");
        setErrorMessage(null);

        getSharedCatalog(shareSlug)
            .then((catalog) => {
                if (!isCurrent) return;

                navigate(`/catalogs/${catalog.id}/build`, {
                    replace: true,
                    state: {
                        source: "shared_catalog",
                        shareSlug,
                    },
                });
            })
            .catch((err) => {
                if (!isCurrent) return;

                const message =
                    err instanceof Error
                        ? err.message
                        : "Failed to load shared catalog";

                setErrorMessage(message);
                setLoadState(
                    message.toLowerCase().includes("not found")
                        ? "not_found"
                        : "error",
                );
            });

        return () => {
            isCurrent = false;
        };
    }, [navigate, shareSlug]);

    if (!shareSlug || loadState === "not_found") {
        return <Navigate to="/catalogs/new" replace />;
    }

    if (loadState === "error") {
        return (
            <div className="flex h-full col-span-full items-center justify-center">
                <div className="bg-surface rounded-[10px] p-8 flex flex-col gap-3 w-full max-w-md">
                    <h1 className="text-xl font-semibold text-background">
                        Shared catalog unavailable
                    </h1>
                    <p className="text-sm text-background/60">
                        {errorMessage ?? "This shared catalog could not be loaded."}
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-accent text-white rounded-md font-semibold hover:bg-accent/90 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full col-span-full items-center justify-center text-background/60 text-sm">
            Loading shared catalog...
        </div>
    );
}
