import { useState, useEffect, useRef } from "react";
import { useFilters } from "./contexts/FavoritesContext";
import { useScheduleFilters } from "./contexts/ScheduleFilterContext";
import Card, { CardProps } from "./components/Card";
import Navbar from "./components/Navbar";
import Loading from "./components/Loading";
import ErrorComponent from "./components/Error";
import {
    getSchedules,
    favoriteSchedule,
    unfavoriteSchedule,
} from "./api/client";
import "./App.css";

type ScheduleData = Omit<CardProps, "isFavorited" | "onFavorite">;

function App() {
    const { showOnlyFavorites } = useFilters();
    const { selectedCampuses, selectedTimes } = useScheduleFilters();
    const [schedules, setSchedules] = useState<ScheduleData[]>([]);
    const [favorites, setFavorites] = useState<Set<number | string>>(new Set());
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const isLoadingRef = useRef(false);
    const ITEMS_PER_PAGE = 50;

    // Infinite scroll - load more when scrolling
    useEffect(() => {
        const handleScroll = () => {
            // Check if user scrolled near bottom (within 500px)
            const scrolledToBottom =
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 500;

            if (scrolledToBottom && !loadingMore && hasMore) {
                loadMore();
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [loadingMore, hasMore, schedules.length, showOnlyFavorites]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || isLoadingRef.current) return;

        try {
            isLoadingRef.current = true;
            setLoadingMore(true);
            const currentOffset = schedules.length;
            const moreSchedules = await getSchedules({
                favoritesOnly: showOnlyFavorites,
                limit: ITEMS_PER_PAGE,
                offset: currentOffset,
                campuses: selectedCampuses,
                times: selectedTimes,
            });

            // Filter out any duplicates based on schedule_id
            setSchedules((prev) => {
                const existingIds = new Set(prev.map((s) => s.schedule_id));
                const newSchedules = moreSchedules.filter(
                    (s: ScheduleData) => !existingIds.has(s.schedule_id)
                );
                return [...prev, ...newSchedules];
            });
            setHasMore(moreSchedules.length === ITEMS_PER_PAGE);
        } catch (err) {
            console.error("Failed to load more schedules:", err);
        } finally {
            setLoadingMore(false);
            isLoadingRef.current = false;
        }
    };

    const handleFavorite = async (scheduleId: number | string) => {
        const isFavorited = favorites.has(scheduleId);

        // Optimistic update
        setFavorites((prev) => {
            const newFavorites = new Set(prev);
            if (isFavorited) {
                newFavorites.delete(scheduleId);
            } else {
                newFavorites.add(scheduleId);
            }
            return newFavorites;
        });

        try {
            if (isFavorited) {
                await unfavoriteSchedule(scheduleId);
            } else {
                await favoriteSchedule(scheduleId);
            }
        } catch (err) {
            // Revert on error
            setFavorites((prev) => {
                const newFavorites = new Set(prev);
                if (isFavorited) {
                    newFavorites.add(scheduleId);
                } else {
                    newFavorites.delete(scheduleId);
                }
                return newFavorites;
            });
            console.error("Failed to toggle favorite:", err);
            alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    if (loading) {
        return <Loading />;
    }

    if (error) {
        return <ErrorComponent error={error} />;
    }

    if (schedules.length === 0) {
        return (
            <div className="space-y-16">
                <Navbar />
                <div className="flex justify-center items-center text-center">
                    <p className="text-lg font-semibold text-gray-500">
                        No schedules found
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Navbar />
            <div className="p-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-10">
                {schedules.map((schedule) => (
                    <Card
                        key={schedule.schedule_id}
                        {...schedule}
                        isFavorited={favorites.has(schedule.schedule_id)}
                        onFavorite={() => handleFavorite(schedule.schedule_id)}
                    />
                ))}
            </div>
            {loadingMore && <Loading />}
            {!hasMore && schedules.length > 0 && (
                <div className="flex justify-center pb-10">
                    <p className="text-lg font-semibold text-gray-500">
                        End of schedules
                    </p>
                </div>
            )}
        </>
    );
}

export default App;
