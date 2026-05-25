import { lazy, ComponentType } from "react";

interface Route {
    path: string;
    Component: React.LazyExoticComponent<ComponentType<unknown>>;
}

// Wizard step components (lazy-loaded)
export const CatalogCreatePage = lazy(
    () => import("@/pages/CatalogCreatePage"),
);
export const ScheduleRequestStep = lazy(
    () => import("@/pages/ScheduleRequestStep"),
);
export const InstructorRatings = lazy(
    () => import("@/pages/InstructorRatings"),
);
export const ScheduleResultsStep = lazy(
    () => import("@/pages/ScheduleResultsStep"),
);

// Wizard shell (lazy-loaded)
export const CatalogWizardShell = lazy(
    () => import("@/components/wizard/CatalogWizardShell"),
);

// Layouts (lazy-loaded)
export const WizardLayout = lazy(
    () => import("@/components/layouts/WizardLayout"),
);

// Non-wizard routes
export const authRoutes: Route[] = [
    {
        path: "/login",
        Component: lazy(() => import("@/pages/Login")),
    },
    {
        path: "/signup",
        Component: lazy(() => import("@/pages/SignUp")),
    },
];

export const fallbackRoutes: Route[] = [
    {
        path: "*",
        Component: lazy(() => import("@/pages/NotFound")),
    },
];
