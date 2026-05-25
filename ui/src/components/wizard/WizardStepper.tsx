import { useLocation, useNavigate, useParams } from "react-router-dom";

const STEPS = [
    { key: "build", label: "Build" },
    { key: "results", label: "Results" },
] as const;

function resolveActiveIndex(pathname: string): number {
    for (let i = STEPS.length - 1; i >= 0; i--) {
        if (pathname.includes(`/${STEPS[i].key}`)) return i;
    }
    return 0;
}

export default function WizardStepper() {
    const { pathname } = useLocation();
    const { catalogId } = useParams<{ catalogId: string }>();
    const navigate = useNavigate();
    const activeIndex = resolveActiveIndex(pathname);

    return (
        <nav className="flex items-center gap-3" aria-label="Wizard progress">
            {STEPS.map((step, i) => {
                const isActive = i === activeIndex;
                const isCompleted = i < activeIndex;
                const isClickable = isCompleted;

                return (
                    <div key={step.key} className="flex items-center gap-3">
                        {i > 0 && (
                            <div
                                className={`w-8 h-[2px] transition-colors duration-300 ${
                                    isCompleted
                                        ? "bg-accent"
                                        : "bg-text/20"
                                }`}
                            />
                        )}
                        <button
                            type="button"
                            disabled={!isClickable}
                            onClick={() => {
                                if (isClickable && catalogId) {
                                    navigate(
                                        `/catalogs/${catalogId}/${step.key}`,
                                    );
                                }
                            }}
                            className={`
                                w-8 h-8 rounded-full text-xs font-semibold
                                flex items-center justify-center
                                transition-all duration-300
                                ${
                                    isActive
                                        ? "bg-accent text-white scale-110"
                                        : isCompleted
                                          ? "bg-accent/70 text-white cursor-pointer hover:bg-accent"
                                          : "bg-text/15 text-text/40 cursor-default"
                                }
                            `}
                            aria-current={isActive ? "step" : undefined}
                            aria-label={`Step ${i + 1}: ${step.label}`}
                        >
                            {i + 1}
                        </button>
                    </div>
                );
            })}
        </nav>
    );
}
