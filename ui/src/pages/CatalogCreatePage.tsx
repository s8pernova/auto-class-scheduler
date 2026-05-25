import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCatalog } from "@/api/client";

export default function CatalogCreatePage() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentYear = new Date().getFullYear();

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;

        setLoading(true);
        setError(null);

        try {
            const catalog = await createCatalog({ name: trimmed });
            navigate(`/catalogs/${catalog.id}/build`, { replace: true });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create catalog",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex items-center justify-center h-full">
            <form
                onSubmit={handleCreate}
                className="bg-surface rounded-[10px] p-8 flex flex-col gap-4 w-full max-w-md"
            >
                <h1 className="text-xl font-semibold text-background">
                    New Catalog
                </h1>
                <p className="text-sm text-background/60">
                    Name your catalog to get started. You can add courses and
                    configure it in the next step.
                </p>
                <input
                    id="catalog-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`e.g. Fall ${currentYear} Schedule`}
                    maxLength={200}
                    required
                    autoFocus
                    className="px-4 py-2 rounded-md border border-background/20 bg-white text-background placeholder:text-background/40 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="px-4 py-2 bg-accent text-white rounded-md font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Creating…" : "Create Catalog"}
                </button>
            </form>
        </div>
    );
}
