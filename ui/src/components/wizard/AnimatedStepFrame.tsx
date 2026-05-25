import {
    useRef,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

const STEP_ORDER = ["build", "results"] as const;

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
    const prevIndexRef = useRef(currentIndex);
    const [direction, setDirection] = useState<"none" | "forward" | "backward">(
        "none",
    );
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        const prev = prevIndexRef.current;
        if (prev !== currentIndex) {
            setDirection(currentIndex > prev ? "forward" : "backward");
            setAnimating(true);
            prevIndexRef.current = currentIndex;

            // Let the enter animation play, then clear the state.
            const id = setTimeout(() => setAnimating(false), 350);
            return () => clearTimeout(id);
        }
    }, [currentIndex]);

    let transformClass = "";
    if (animating) {
        if (direction === "forward") {
            transformClass = "wizard-slide-in-right";
        } else if (direction === "backward") {
            transformClass = "wizard-slide-in-left";
        }
    }

    return (
        <div
            className={`wizard-step-frame min-h-0 col-span-full grid grid-cols-subgrid ${transformClass}`}
        >
            {children}
        </div>
    );
}
