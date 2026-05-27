import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

const STEP_ORDER = ["build", "instructors"] as const;

type RouteTransition = {
    pathname: string;
    currentIndex: number;
    previousIndex: number;
};

function stepIndex(pathname: string): number {
    for (let i = STEP_ORDER.length - 1; i >= 0; i--) {
        if (pathname.includes(`/${STEP_ORDER[i]}`)) return i;
    }
    return 0;
}

export default function AnimatedStepFrame({
    children,
}: {
    children: ReactNode;
}) {
    const { pathname } = useLocation();
    const currentIndex = stepIndex(pathname);
    const [transition, setTransition] = useState<RouteTransition>(() => ({
        pathname,
        currentIndex,
        previousIndex: currentIndex,
    }));

    if (transition.pathname !== pathname) {
        setTransition({
            pathname,
            currentIndex,
            previousIndex: transition.currentIndex,
        });
    }

    let transformClass = "";
    if (transition.currentIndex > transition.previousIndex) {
        transformClass = "wizard-slide-in-right";
    } else if (transition.currentIndex < transition.previousIndex) {
        transformClass = "wizard-slide-in-left";
    }

    return (
        <div
            key={pathname}
            className={`wizard-step-frame min-h-0 col-span-full grid grid-cols-subgrid ${transformClass}`}
        >
            {children}
        </div>
    );
}
