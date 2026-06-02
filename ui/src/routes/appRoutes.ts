import { lazy, ComponentType } from "react";

interface Route {
    path: string;
    Component: React.LazyExoticComponent<ComponentType<unknown>>;
}

// Catalog flow pages (lazy-loaded)
export const CatalogCreatePage = lazy(
    () => import("@/pages/CatalogCreatePage"),
);
export const ScheduleRequestStep = lazy(
    () => import("@/pages/ScheduleRequestStep"),
);
export const ScheduleResultsStep = lazy(
    () => import("@/pages/ScheduleResultsStep"),
);

// Catalog flow shells (lazy-loaded)
export const CatalogFlowShell = lazy(
    () => import("@/components/wizard/CatalogFlowShell"),
);
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
