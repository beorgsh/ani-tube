import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getLatest } from "../api";
import type { Episode } from "../types";
import VideoCard from "../components/VideoCard";
import Header from "../components/Header";

// Skeleton Loader
function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="w-full aspect-video bg-gray-800 rounded-xl"></div>
      <div className="h-4 bg-gray-800 rounded w-4/5"></div>
      <div className="h-3 bg-gray-800 rounded w-1/3"></div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  // Extracted click handler
  const handleCardClick = (episode: Episode) => {
    navigate(`/watch/${episode.anime_session}?ep=${episode.session}`);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchEpisodes = async () => {
      if (!hasMore || !isMounted) return;

      setLoading(true);
      setError(null);

      try {
        const newEpisodes = await getLatest(page);

        if (!isMounted) return;

        if (newEpisodes.length === 0) {
          setHasMore(false);
        } else {
          setEpisodes((prev) => {
            const seen = new Set(prev.map((e) => e.session));
            const uniqueNew = newEpisodes.filter((e) => !seen.has(e.session));
            return [...prev, ...uniqueNew];
          });
        }
      } catch (err) {
        console.error("Failed to load episodes:", err);
        if (isMounted) {
          setError("Failed to load episodes. Please try again later.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEpisodes();

    return () => {
      isMounted = false;
    };
  }, [page, hasMore]);

  // Reset on unmount / remount if needed (optional)
  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <Header />

      <main className="pt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1 md:gap-1 lg:gap-1 py-20">
          {episodes.map((item, index) => {
            const isLast = index === episodes.length - 1;

            return (
              <div
                key={`${item.session}-${index}`}
                ref={isLast ? lastElementRef : null}
              >
                <VideoCard item={item} onClick={handleCardClick} />
              </div>
            );
          })}

          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))}
        </div>

        {error && (
          <div className="text-center py-12 text-red-400">
            {error}
            <button
              onClick={() => {
                setError(null);
                setPage(1);
                setEpisodes([]);
                setHasMore(true);
              }}
              className="ml-4 underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {!hasMore && episodes.length > 0 && !loading && (
          <div className="text-center text-gray-500 py-12">
            You've reached the end — no more episodes to load.
          </div>
        )}

        {episodes.length === 0 && !loading && !error && (
          <div className="text-center py-20 text-gray-400">
            No episodes found. Check back later!
          </div>
        )}
      </main>
    </div>
  );
}
