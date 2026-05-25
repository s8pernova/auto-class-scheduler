import { Outlet, useMatch } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import WizardStepper from "@/components/wizard/WizardStepper";

export default function WizardLayout() {
    const isWizardRoute = useMatch("/catalogs/:catalogId/*");

    return (
        <div className="grid grid-rows-[38px_1fr] h-screen gap-[15px] p-[15px]">
            <Navbar center={isWizardRoute ? <WizardStepper /> : null} />
            <Outlet />
        </div>
    );
}
