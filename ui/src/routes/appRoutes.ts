import { lazy, ComponentType } from "react";

interface Route {
    path: string;
    Component: React.LazyExoticComponent<ComponentType<unknown>>;
}

export const appRoutes: Route[] = [
    {
        path: "/",
        Component: lazy(() => import("@/pages/ScheduleBuilder.tsx")),
    },
    {
        path: "/schedules",
        Component: lazy(() => import("@/pages/PossibleSchedules.tsx")),
    },
    {
        path: "/schedules/favorites",
        Component: lazy(() => import("@/pages/FavoriteSchedules.tsx")),
    },
    {
        path: "/login",
        Component: lazy(() => import("@/pages/Login.tsx")),
    },
    {
        path: "/signup",
        Component: lazy(() => import("@/pages/SignUp.tsx")),
    },
];

export const fallbackRoutes: Route[] = [
    {
        path: "*",
        Component: lazy(() => import("@/pages/NotFound.tsx")),
    },
];