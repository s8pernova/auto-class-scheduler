import { Outlet, useParams } from "react-router-dom";
import { ScheduleDraftProvider } from "@/contexts/ScheduleDraftContext";

export default function CatalogFlowShell() {
    const { catalogId } = useParams<{ catalogId: string }>();

    if (!catalogId) {
        throw new Error("CatalogFlowShell requires a :catalogId route param");
    }

    return (
        <ScheduleDraftProvider catalogId={catalogId}>
            <Outlet />
        </ScheduleDraftProvider>
    );
}
