import { Outlet, useMatch } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import WizardStepper from "@/components/wizard/WizardStepper";

export default function WizardLayout() {
    const isCatalogCreateRoute = useMatch("/catalogs/new");
    const isBuildRoute = useMatch("/catalogs/:catalogId/build");
    const isInstructorRoute = useMatch("/catalogs/:catalogId/instructors");
    const isWizardRoute =
        isCatalogCreateRoute || isBuildRoute || isInstructorRoute;

    return (
        // TODO: these values should be in the css as vars
        <div className="h-screen grid grid-cols-[2fr_5fr_3fr] grid-rows-[auto_1fr] gap-y-[15px] gap-x-[10px] p-[15px]">
            <Navbar center={isWizardRoute ? <WizardStepper /> : null} />
            <Outlet />
        </div>
    );
}
