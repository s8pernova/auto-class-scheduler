import { Outlet, useLocation, useParams } from "react-router-dom";
import type { CatalogResponse } from "@/api";
import { ScheduleDraftProvider } from "@/contexts/ScheduleDraftContext";

interface SharedCatalogLocationState {
    source: "shared_catalog";
    shareSlug: string;
    catalog?: CatalogResponse;
}

function getSharedCatalogState(value: unknown): SharedCatalogLocationState | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const state = value as Partial<SharedCatalogLocationState>;

    if (state.source !== "shared_catalog" || typeof state.shareSlug !== "string") {
        return null;
    }

    return {
        source: "shared_catalog",
        shareSlug: state.shareSlug,
        catalog: state.catalog,
    };
}

export default function CatalogFlowShell() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const location = useLocation();
    const sharedCatalogState = getSharedCatalogState(location.state);

    if (!catalogId) {
        throw new Error("CatalogFlowShell requires a :catalogId route param");
    }

    return (
        <ScheduleDraftProvider
            catalogId={catalogId}
            entryCatalog={sharedCatalogState?.catalog}
            entryShareSlug={sharedCatalogState?.shareSlug}
            isSharedEntry={sharedCatalogState !== null}
        >
            <Outlet />
        </ScheduleDraftProvider>
    );
}
