import { Outlet, useMatch } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import WizardStepper from "@/components/wizard/WizardStepper";

export default function WizardLayout() {
    const isWizardRoute = useMatch("/catalogs/:catalogId/*");

    return (
        // TODO: these values should be in the css as vars
        <div className="h-screen grid grid-cols-[380px_1fr_300px] grid-rows-[auto_1fr] gap-[15px] p-[15px]">
            <Navbar center={isWizardRoute ? <WizardStepper /> : null} />
            <Outlet />
        </div>
    );
}
