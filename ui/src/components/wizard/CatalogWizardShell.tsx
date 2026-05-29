import { Outlet } from "react-router-dom";
import AnimatedStepFrame from "@/components/wizard/AnimatedStepFrame";

export default function CatalogWizardShell() {
    return (
        <AnimatedStepFrame>
            <Outlet />
        </AnimatedStepFrame>
    );
}
