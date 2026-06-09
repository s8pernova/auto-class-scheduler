import { Outlet, useLocation, useParams } from "react-router-dom";
import type { CatalogResponse } from "@/api";
import {
    ScheduleDraftProvider,
    type ScheduleDraft,
} from "@/contexts/ScheduleDraftContext";

interface CatalogLocationState {
    source?: "shared_catalog" | "forked_catalog";
    shareSlug?: string;
    catalog?: CatalogResponse;
    draft?: ScheduleDraft;
}

function getCatalogLocationState(value: unknown): CatalogLocationState | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const state = value as Partial<CatalogLocationState>;

    if (
        state.source !== "shared_catalog" &&
        state.source !== "forked_catalog"
    ) {
        return {};
    }

    return {
        source: state.source,
        shareSlug:
            typeof state.shareSlug === "string" ? state.shareSlug : undefined,
        catalog: state.catalog,
        draft: state.draft,
    };
}

export default function CatalogFlowShell() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const location = useLocation();
    const catalogLocationState = getCatalogLocationState(location.state);

    if (!catalogId) {
        throw new Error("CatalogFlowShell requires a :catalogId route param");
    }

    return (
        <ScheduleDraftProvider
            catalogId={catalogId}
            entryCatalog={catalogLocationState?.catalog}
            entryDraft={catalogLocationState?.draft}
            entryShareSlug={catalogLocationState?.shareSlug}
            isSharedEntry={catalogLocationState?.source === "shared_catalog"}
        >
            <Outlet />
        </ScheduleDraftProvider>
    );
}
