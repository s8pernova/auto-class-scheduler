import { useParams } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { ScheduleDraftProvider } from "@/contexts/ScheduleDraftContext";
import AnimatedStepFrame from "@/components/wizard/AnimatedStepFrame";

export default function CatalogWizardShell() {
    const { catalogId } = useParams<{ catalogId: string }>();

    if (!catalogId) {
        throw new Error("CatalogWizardShell requires a :catalogId route param");
    }

    return (
        <ScheduleDraftProvider catalogId={catalogId}>
            <AnimatedStepFrame>
                <Outlet />
            </AnimatedStepFrame>
        </ScheduleDraftProvider>
    );
}
