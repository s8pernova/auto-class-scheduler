import { useEffect, useState } from "react";
import { FaStar } from "react-icons/fa";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createCatalog, getSchedules } from "@/api";
import type { ScheduleSummaryResponse } from "@/api/generated";
import { useAuth } from "@/hooks/useAuth";
import { formatTime } from "@/utils/scheduleResults";

type FavoriteLoadState = "idle" | "loading" | "success" | "error";

const DAY_LABELS: Array<[keyof ScheduleSummaryResponse, string]> = [
    ["meets_mon", "Mon"],
    ["meets_tue", "Tue"],
    ["meets_wed", "Wed"],
    ["meets_thu", "Thu"],
    ["meets_fri", "Fri"],
    ["meets_sat", "Sat"],
];

function getMeetingDays(schedule: ScheduleSummaryResponse): string {
    const days = DAY_LABELS.filter(([key]) => Boolean(schedule[key])).map(
        ([, label]) => label,
    );
    return days.length > 0 ? days.join(", ") : "No meeting days";
}

function formatInstructorScore(score: number | null | undefined): string {
    return score == null ? "No instructor score" : `${score.toFixed(1)} rating`;
}

export default function CatalogCreatePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { status, user } = useAuth();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<ScheduleSummaryResponse[]>([]);
    const [favoriteLoadState, setFavoriteLoadState] =
        useState<FavoriteLoadState>("idle");
    const [favoriteError, setFavoriteError] = useState<string | null>(null);
    const currentYear = new Date().getFullYear();
    const isFavoritesView = searchParams.get("view") === "favorites";
    const isKnownUser = status === "signed_in" && !user?.is_anonymous;

    useEffect(() => {
        if (!isFavoritesView || !isKnownUser) {
            return;
        }

        let isCurrent = true;

        Promise.resolve().then(() => {
            if (!isCurrent) {
                return;
            }
            setFavoriteLoadState("loading");
            setFavoriteError(null);
        });

        getSchedules({ favoritesOnly: true })
            .then((schedules) => {
                if (!isCurrent) {
                    return;
                }
                setFavorites(schedules);
                setFavoriteLoadState("success");
            })
            .catch((err) => {
                if (!isCurrent) {
                    return;
                }
                setFavoriteLoadState("error");
                setFavoriteError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load favorites.",
                );
            });

        return () => {
            isCurrent = false;
        };
    }, [isFavoritesView, isKnownUser]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;

        setLoading(true);
        setError(null);

        try {
            const catalog = await createCatalog({ name: trimmed });
            navigate(`/catalogs/${catalog.id}/build`, { replace: true });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create catalog",
            );
        } finally {
            setLoading(false);
        }
    }

    if (isFavoritesView) {
        if (status === "booting") {
            return (
                <div className="h-full col-span-full flex items-center justify-center text-background/50 text-sm">
                    Loading favorites.
                </div>
            );
        }

        if (!isKnownUser) {
            return (
                <div className="flex items-center justify-center h-full col-span-full">
                    <div className="bg-surface rounded-[10px] p-8 flex flex-col gap-4 w-full max-w-md text-background">
                        <h1 className="text-xl font-semibold">Favorites</h1>
                        <p className="text-sm text-background/60">
                            Sign in to view your favorite schedules.
                        </p>
                        <Link
                            className="px-4 py-2 bg-accent text-white rounded-md font-semibold hover:bg-accent/90 transition-colors text-center"
                            state={{ from: "/catalogs/new?view=favorites" }}
                            to="/login"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            );
        }

        return (
            <main className="col-span-full overflow-y-auto rounded-[10px] bg-surface p-8 text-background">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold">
                                Favorite schedules
                            </h1>
                            <p className="text-sm text-background/65">
                                {favorites.length} saved schedule
                                {favorites.length === 1 ? "" : "s"}
                            </p>
                        </div>
                        <Link
                            className="rounded-md border border-background/20 px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
                            to="/catalogs/new"
                        >
                            New catalog
                        </Link>
                    </div>

                    {favoriteLoadState === "loading" ? (
                        <div className="rounded-[8px] border border-background/10 bg-background/5 p-6 text-sm text-background/70">
                            Loading saved schedules.
                        </div>
                    ) : null}

                    {favoriteLoadState === "error" ? (
                        <div
                            className="rounded-[8px] border border-red-700/30 bg-red-100 p-6 text-sm text-red-800"
                            role="alert"
                        >
                            {favoriteError}
                        </div>
                    ) : null}

                    {favoriteLoadState === "success" &&
                    favorites.length === 0 ? (
                        <div className="rounded-[8px] border border-background/10 bg-background/5 p-6 text-sm text-background/70">
                            No favorite schedules yet.
                        </div>
                    ) : null}

                    {favorites.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {favorites.map((schedule) => (
                                <article
                                    className="rounded-[8px] border border-background/10 bg-background/5 p-5"
                                    key={schedule.schedule_id}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="font-semibold">
                                                <FaStar className="mr-2 inline text-yellow-500" />
                                                Schedule {schedule.schedule_id}
                                            </h2>
                                            <p className="mt-1 text-sm text-background/65">
                                                {schedule.total_credits} credits ·{" "}
                                                {schedule.num_sections} sections ·{" "}
                                                {getMeetingDays(schedule)}
                                            </p>
                                        </div>
                                        <div className="text-right text-sm text-background/70">
                                            <p>
                                                {formatTime(
                                                    schedule.earliest_start,
                                                )}{" "}
                                                -{" "}
                                                {formatTime(schedule.latest_end)}
                                            </p>
                                            <p>{schedule.campus_pattern}</p>
                                        </div>
                                    </div>

                                    <p className="mt-3 text-sm text-background/70">
                                        {formatInstructorScore(
                                            schedule.total_instructor_score,
                                        )}
                                    </p>

                                    <div className="mt-4 space-y-2">
                                        {(schedule.sections ?? []).map(
                                            (section) => (
                                                <div
                                                    className="rounded-[6px] bg-background/10 p-3 text-sm"
                                                    key={
                                                        section.catalog_section_meeting_id ??
                                                        section.catalog_section_id ??
                                                        `${schedule.schedule_id}-${section.course_name}-${section.section_code}`
                                                    }
                                                >
                                                    <div className="flex justify-between gap-3">
                                                        <span className="font-medium">
                                                            {section.course_name ??
                                                                "Untitled course"}{" "}
                                                            {section.section_code ??
                                                                ""}
                                                        </span>
                                                        <span className="text-background/60">
                                                            {section.instructor_name ??
                                                                "Instructor TBD"}
                                                        </span>
                                                    </div>
                                                    {section.meetings?.length ? (
                                                        <p className="mt-1 text-background/60">
                                                            {section.meetings
                                                                .map(
                                                                    (meeting) =>
                                                                        `${meeting.day_of_week} ${formatTime(meeting.start_time)}-${formatTime(meeting.end_time)}`,
                                                                )
                                                                .join(", ")}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : null}
                </div>
            </main>
        );
    }

    return (
        <div className="flex items-center justify-center h-full col-span-full">
            <form
                onSubmit={handleCreate}
                className="bg-surface rounded-[10px] p-8 flex flex-col gap-4 w-full max-w-md"
            >
                <h1 className="text-xl font-semibold text-background">
                    New Catalog
                </h1>
                <p className="text-sm text-background/60">
                    Name your catalog to get started. You can add courses and
                    configure it in the next step.
                </p>
                <input
                    id="catalog-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`e.g. Fall ${currentYear} Schedule`}
                    maxLength={200}
                    required
                    autoFocus
                    className="px-4 py-2 rounded-md border border-background/20 bg-white text-background placeholder:text-background/40 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="px-4 py-2 bg-accent text-white rounded-md font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Creating…" : "Create Catalog"}
                </button>
            </form>
        </div>
    );
}
