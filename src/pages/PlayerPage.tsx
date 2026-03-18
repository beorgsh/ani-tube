import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getAnimeInfo,
  getHiAnimeEpisodes,
  getAnimePaheEpisodes,
  resolveVideo,
} from "../api";
import { VideoPlayer } from "../components/VideoPlayer";

export default function PlayerPage() {
  const { anime_session } = useParams<{ anime_session: string }>();
  const navigate = useNavigate();

  // 🔥 Extract the exact episode session from the URL query
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetEpSession = queryParams.get("ep");

  const [episodes, setEpisodes] = useState<any[]>([]);
  const [animeInfo, setAnimeInfo] = useState<any>(null);
  const [hianimeInfo, setHianimeInfo] = useState<any>(null);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [activeEpIndex, setActiveEpIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Audio Track State (Sub/Dub)
  const [videoStreams, setVideoStreams] = useState<{
    sub: string | null;
    dub: string | null;
  }>({ sub: null, dub: null });
  const [audioMode, setAudioMode] = useState<"sub" | "dub">("sub");

  const [descExpanded, setDescExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"recommendations" | "seasons">(
    "recommendations",
  );

  useEffect(() => {
    async function fetchEpisodes() {
      if (!anime_session) return;
      try {
        setLoading(true);
        setHianimeInfo(null);
        setAnimeInfo(null);
        setDescExpanded(false);

        // 1. Fetch Primary Anime Info
        const infoRes = await getAnimeInfo(anime_session);
        if (infoRes) setAnimeInfo(infoRes);

        let anilistId = infoRes?.id || infoRes?.ids?.anilist;

        // 🔥 FALLBACK RETRY LOGIC 🔥
        // If anilistId is missing, try to get it from the mapper directly
        if (!anilistId) {
          console.warn(
            "Anilist ID not found in primary backend. Retrying fallback mapper...",
          );
          try {
            // Note: We use the anime_session as the lookup key in the mapper
            const fallbackRes = await fetch(
              `https://anilistmapper.vercel.app/animepahe/map/${anime_session}`,
            ).then((res) => (res.ok ? res.json() : null));

            // Adjust this based on what the mapper returns (usually it returns a JSON with anilistId)
            anilistId = fallbackRes?.anilistId || fallbackRes?.id;
          } catch (fallbackErr) {
            console.error("Fallback mapper failed:", fallbackErr);
          }
        }

        // Final check: if still no ID, we have to stop
        if (!anilistId)
          throw new Error("Anilist ID could not be found after retry.");

        // 2. Fetch HiAnime ID and Seasons safely (using the ID we just found)
        fetch(`https://anilistmapper.vercel.app/hianime/${anilistId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((mapperRes) => {
            if (!mapperRes) return null;
            const hiId = mapperRes?.hianimeId || mapperRes?.id;
            if (hiId) {
              return fetch(
                `https://catapang1989-aniscrap.hf.space/seasons/${hiId}`,
              ).then((r) => (r.ok ? r.json() : null));
            }
            return null;
          })
          .then((seasonsData) => {
            if (seasonsData) setHianimeInfo(seasonsData);
          })
          .catch((err) =>
            console.log("Seasons fetching bypassed:", err.message),
          );

        // 3. Fetch Episode Lists
        const [hiRes, paheRes] = await Promise.allSettled([
          getHiAnimeEpisodes(anilistId),
          getAnimePaheEpisodes(anilistId),
        ]);

        const hiDataRaw = hiRes.status === "fulfilled" ? hiRes.value : null;
        const paheDataRaw =
          paheRes.status === "fulfilled" ? paheRes.value : null;

        // Extraction logic
        const safelyExtractArray = (data: any): any[] => {
          if (!data) return [];
          if (Array.isArray(data)) return data;
          if (data.animepahe?.episodes) return data.animepahe.episodes;
          if (data.hianime?.episodes) return data.hianime.episodes;
          return [];
        };

        const hiData = safelyExtractArray(hiDataRaw);
        const paheData = safelyExtractArray(paheDataRaw);
        const baseList = hiData.length > 0 ? hiData : paheData;

        // 4. Merge data
        const mergedEpisodes = baseList.map((ep: any, index: number) => {
          const epNum = ep.number || ep.episode || index + 1;
          const paheEp =
            paheData.find((p: any) => String(p.number) === String(epNum)) ||
            paheData[index] ||
            {};

          let rawSession =
            paheEp.session || paheEp.episodeId || paheEp.id || null;
          if (rawSession && rawSession.includes("/")) {
            rawSession = rawSession.split("/").pop();
          }

          return {
            ...ep,
            number: epNum,
            paheSession: rawSession,
            finalThumb: ep.image || paheEp.snapshot || null,
            finalOverview: ep.description || paheEp.overview || null,
          };
        });

        setEpisodes(mergedEpisodes);

        // 5. Autoplay logic
        if (mergedEpisodes.length > 0) {
          let targetIndex = 0;
          if (targetEpSession) {
            const foundIndex = mergedEpisodes.findIndex(
              (ep: any) => ep.paheSession === targetEpSession,
            );
            if (foundIndex !== -1) targetIndex = foundIndex;
          }
          playEpisode(mergedEpisodes[targetIndex], targetIndex);
        }
      } catch (error: any) {
        console.error("Error fetching player data:", error);
        setVideoError(error.message); // Displays the error in the player area
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, [anime_session]);

  const playEpisode = async (episode: any, index: number) => {
    if (!episode.paheSession) return;

    navigate(`/watch/${anime_session}?ep=${episode.paheSession}`, {
      replace: true,
    });

    setActiveEpIndex(index);
    setCurrentSource(null);
    setVideoError(null);
    setVideoStreams({ sub: null, dub: null });

    try {
      const videoData = await resolveVideo(anime_session!, episode.paheSession);

      const subStream =
        videoData.sub?.download || videoData.sub?.link || videoData.url || null;
      const dubStream = videoData.dub?.download || videoData.dub?.link || null;

      setVideoStreams({ sub: subStream, dub: dubStream });

      let targetStream = subStream;
      let targetMode: "sub" | "dub" = "sub";

      if (audioMode === "dub" && dubStream) {
        targetStream = dubStream;
        targetMode = "dub";
      } else if (!subStream && dubStream) {
        targetStream = dubStream;
        targetMode = "dub";
      }

      setAudioMode(targetMode);

      if (targetStream) {
        setCurrentSource(targetStream);
      } else {
        setVideoError("Video stream could not be found.");
      }
    } catch (error) {
      console.error("Error resolving video:", error);
      setVideoError("Failed to connect to video server.");
    }
  };

  const videoJsOptions = useMemo(
    () => ({
      autoplay: true,
      controls: true,
      responsive: true,
      fill: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      sources: currentSource
        ? [
            {
              src: currentSource,
              type: currentSource.includes(".m3u8")
                ? "application/x-mpegURL"
                : "video/mp4",
            },
          ]
        : [],
    }),
    [currentSource],
  );

  const handleAnimeChange = (newId: string | number) => {
    if (!anime_session) return;
    const newPath = window.location.pathname.replace(
      anime_session,
      String(newId),
    );
    navigate(newPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeEp = episodes[activeEpIndex];
  const animeTitle =
    animeInfo?.title?.english ||
    animeInfo?.title?.romaji ||
    animeInfo?.title?.native ||
    "Unknown Anime";
  const activeThumbnail =
    activeEp?.finalThumb ||
    animeInfo?.banner_image ||
    animeInfo?.cover_image?.extraLarge;

  const formatCompactNumber = (num?: number) => {
    if (!num) return "0";
    return Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  };

  const seasonsList = hianimeInfo?.seasons || [];
  const recommendationsList = animeInfo?.recommendations || [];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] pb-10 pt-24">
      <div className="max-w-[1700px] mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* TOP SECTION: 2 COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-4 lg:gap-6 lg:items-stretch">
          {/* LEFT COLUMN (Player + Description) */}
          <div className="order-1 flex flex-col w-full min-w-0">
            {/* THE PLAYER */}
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center">
              {loading ? (
                <div className="w-full h-full bg-[#181818] animate-pulse flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-[#3f3f3f] border-t-[#aaaaaa] rounded-full animate-spin mb-3"></div>
                  <p className="text-[#aaaaaa] font-medium">Loading Anime...</p>
                </div>
              ) : currentSource ? (
                <VideoPlayer options={videoJsOptions} />
              ) : (
                <div className="relative w-full h-full bg-[#050505] overflow-hidden flex items-center justify-center">
                  {activeThumbnail && (
                    <img
                      src={activeThumbnail}
                      alt="Loading Episode"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-105"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                    {videoError ? (
                      <>
                        <div className="text-[#ff4e45] text-4xl mb-2">⚠</div>
                        <p className="text-white font-medium drop-shadow-md">
                          {videoError}
                        </p>
                        <button
                          onClick={() => playEpisode(activeEp, activeEpIndex)}
                          className="mt-4 px-5 py-2 bg-[#272727] hover:bg-[#3d3d3d] rounded-full text-sm font-semibold transition-colors"
                        >
                          Try Again
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin mb-4 shadow-lg"></div>
                        <p className="text-white font-medium text-sm drop-shadow-md">
                          {activeEp?.paheSession
                            ? `Loading Episode ${activeEp.number}...`
                            : "No video source available"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* YOUTUBE STYLE: TITLE & ACTIONS ROW */}
            <div className="pt-4 pb-2">
              {/* Title Skeleton vs Actual Title */}
              {loading ? (
                <div className="h-7 md:h-8 bg-[#272727] rounded-md w-3/4 animate-pulse mb-2"></div>
              ) : (
                <h1 className="text-xl md:text-2xl font-bold text-[#f1f1f1] leading-tight line-clamp-2">
                  {activeEp?.title ||
                    `Episode ${activeEp?.number || activeEpIndex + 1} - ${animeTitle}`}
                </h1>
              )}

              {loading ? (
                // Meta & Actions Skeleton Loader
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#272727] animate-pulse flex-shrink-0"></div>
                    <div className="flex flex-col gap-2">
                      <div className="h-4 bg-[#272727] rounded w-40 animate-pulse"></div>
                      <div className="h-3 bg-[#272727] rounded w-28 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-24 bg-[#272727] rounded-full animate-pulse"></div>
                    <div className="h-9 w-32 bg-[#272727] rounded-full animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-[#272727] flex-shrink-0">
                      {animeInfo?.cover_image?.large && (
                        <img
                          src={animeInfo.cover_image.large}
                          alt="Anime Cover"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <h3 className="text-[#f1f1f1] font-bold text-base leading-tight line-clamp-1">
                        {animeTitle}
                      </h3>
                      <p className="text-[#aaaaaa] text-xs mt-0.5">
                        {formatCompactNumber(
                          animeInfo?.favourites || animeInfo?.popularity,
                        )}{" "}
                        Favorites •{" "}
                        {animeInfo?.studios?.[0] || "Unknown Studio"}
                      </p>
                    </div>

                    <a
                      href={currentSource || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`ml-2 bg-[#f1f1f1] hover:bg-[#d9d9d9] text-[#0f0f0f] px-4 py-1.5 rounded-full font-bold text-sm transition-colors hidden sm:flex items-center gap-1.5 ${!currentSource ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                      </svg>
                      Download
                    </a>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                    <div className="flex items-center bg-[#272727] rounded-full text-sm font-medium">
                      <button
                        disabled={!videoStreams.sub}
                        onClick={() => {
                          setAudioMode("sub");
                          setCurrentSource(videoStreams.sub);
                        }}
                        className={`px-4 py-2 rounded-l-full border-r border-[#3f3f3f] transition-colors ${audioMode === "sub" ? "bg-white text-black font-bold" : "hover:bg-[#3f3f3f] text-[#aaaaaa]"} ${!videoStreams.sub && "opacity-40 cursor-not-allowed"}`}
                      >
                        SUB
                      </button>
                      <button
                        disabled={!videoStreams.dub}
                        onClick={() => {
                          setAudioMode("dub");
                          setCurrentSource(videoStreams.dub);
                        }}
                        className={`px-4 py-2 rounded-r-full transition-colors ${audioMode === "dub" ? "bg-white text-black font-bold" : "hover:bg-[#3f3f3f] text-[#aaaaaa]"} ${!videoStreams.dub && "opacity-40 cursor-not-allowed"}`}
                      >
                        DUB
                      </button>
                    </div>

                    <div className="flex items-center bg-[#272727] rounded-full text-sm font-medium">
                      <button
                        disabled={activeEpIndex === 0}
                        onClick={() =>
                          playEpisode(
                            episodes[activeEpIndex - 1],
                            activeEpIndex - 1,
                          )
                        }
                        className={`flex items-center gap-1 px-4 py-2 rounded-l-full border-r border-[#3f3f3f] transition-colors ${activeEpIndex === 0 ? "opacity-50 cursor-not-allowed text-[#777]" : "hover:bg-[#3f3f3f] text-[#f1f1f1]"}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                        </svg>
                        Prev
                      </button>
                      <button
                        disabled={activeEpIndex === episodes.length - 1}
                        onClick={() =>
                          playEpisode(
                            episodes[activeEpIndex + 1],
                            activeEpIndex + 1,
                          )
                        }
                        className={`flex items-center gap-1 px-4 py-2 rounded-r-full transition-colors ${activeEpIndex === episodes.length - 1 ? "opacity-50 cursor-not-allowed text-[#777]" : "hover:bg-[#3f3f3f] text-[#f1f1f1]"}`}
                      >
                        Next
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Description Box */}
              {loading ? (
                <div className="bg-[#272727] mt-4 p-3 rounded-xl h-28 animate-pulse"></div>
              ) : (
                <div
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="bg-[#272727] hover:bg-[#3f3f3f] transition-colors mt-4 p-3 rounded-xl text-sm text-[#f1f1f1] cursor-pointer"
                >
                  <div className="font-bold mb-1 flex flex-wrap gap-2 text-[#f1f1f1]">
                    <span>
                      {animeInfo?.episodes || episodes.length} Episodes
                    </span>
                    {animeInfo?.start_date && (
                      <span>• Premiered {animeInfo.start_date}</span>
                    )}
                    {animeInfo?.status && <span>• {animeInfo.status}</span>}
                  </div>

                  {animeInfo?.genres && (
                    <div className="mb-2 text-[#3ea6ff] font-medium">
                      {animeInfo.genres
                        .map((g: string) => `#${g.replace(/\s+/g, "")}`)
                        .join(" ")}
                    </div>
                  )}

                  <div
                    className={`whitespace-pre-line text-[#f1f1f1] leading-relaxed ${descExpanded ? "" : "line-clamp-2"}`}
                  >
                    {animeInfo?.synopsis ||
                      "No description available for this anime."}
                  </div>

                  <span className="font-bold text-[#f1f1f1] mt-2 block">
                    {descExpanded ? "Show less" : "...more"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: PLAYLIST */}
          <div className="order-2 w-full h-[550px] lg:h-auto lg:relative min-w-0">
            <div className="w-full h-full lg:absolute lg:inset-0 flex flex-col border border-[#3f3f3f] rounded-xl overflow-hidden bg-[#181818]">
              <div className="p-4 bg-[#212121] border-b border-[#3f3f3f] flex-shrink-0 flex flex-col gap-1 z-10">
                <h2 className="text-lg font-bold text-[#f1f1f1]">Episodes</h2>
                <p className="text-xs text-[#aaaaaa]">
                  {loading
                    ? "Loading..."
                    : `${animeInfo?.format || "TV"} • ${activeEp ? `Currently playing: Ep ${activeEp.number}` : "Select an episode"}`}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1 [&::-webkit-scrollbar]:w-2[&::-webkit-scrollbar-thumb]:bg-[#444] hover:[&::-webkit-scrollbar-thumb]:bg-[#666] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 bg-[#272727] rounded-lg animate-pulse flex-shrink-0"
                    />
                  ))}

                {!loading &&
                  episodes.map((ep, index) => {
                    const isActive = activeEpIndex === index;
                    return (
                      <button
                        key={index}
                        onClick={() => playEpisode(ep, index)}
                        disabled={!ep.paheSession}
                        className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors relative group
                          ${isActive ? "bg-[#3d3d3d]" : "hover:bg-[#272727]"}
                          ${!ep.paheSession && "opacity-50 cursor-not-allowed"}
                        `}
                      >
                        <div className="relative w-28 aspect-video bg-[#0f0f0f] rounded-md overflow-hidden flex-shrink-0">
                          {ep.finalThumb ? (
                            <img
                              src={ep.finalThumb}
                              alt={`Ep ${ep.number}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#aaaaaa] text-[10px]">
                              No Image
                            </div>
                          )}

                          <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 text-[10px] font-bold text-white rounded shadow-sm">
                            Ep {ep.number}
                          </div>

                          {isActive && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-[#f1f1f1] border-b-[6px] border-b-transparent ml-1"></div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col flex-1 overflow-hidden pr-1 justify-center min-h-full py-0.5">
                          <span
                            className={`text-sm font-medium line-clamp-1 leading-tight ${isActive ? "text-white" : "text-[#f1f1f1]"}`}
                          >
                            {ep.title || `Episode ${ep.number}`}
                          </span>

                          <span className="text-xs text-[#aaaaaa] mt-1 line-clamp-2 leading-snug">
                            {ep.finalOverview || "No available overview"}
                          </span>

                          {!ep.paheSession && (
                            <span className="text-[10px] font-bold text-[#ff4e45] mt-1 uppercase">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: TABS (Recommendations & Seasons) */}
        <div className="w-full border-t border-[#3f3f3f] pt-6 mt-2">
          <div className="flex gap-6 border-b border-[#3f3f3f] pb-0">
            <button
              onClick={() => setActiveTab("recommendations")}
              className={`pb-3 font-medium text-base transition-colors border-b-2 ${
                activeTab === "recommendations"
                  ? "text-white border-white"
                  : "text-[#aaaaaa] border-transparent hover:text-white"
              }`}
            >
              Recommendations
            </button>
            <button
              onClick={() => setActiveTab("seasons")}
              className={`pb-3 font-medium text-base transition-colors border-b-2 ${
                activeTab === "seasons"
                  ? "text-white border-white"
                  : "text-[#aaaaaa] border-transparent hover:text-white"
              }`}
            >
              Seasons
            </button>
          </div>

          <div className="py-6">
            {loading ? (
              // 🌟 SKELETON LOADER FOR GRID ITEMS
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="aspect-[3/4] rounded-lg bg-[#272727] animate-pulse"></div>
                    <div className="h-4 bg-[#272727] rounded w-3/4 animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* RECOMMENDATIONS TAB */}
                {activeTab === "recommendations" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {recommendationsList.length > 0 ? (
                      recommendationsList.map((r: any) => (
                        <div
                          key={r.id}
                          onClick={() => handleAnimeChange(r.id)}
                          className="cursor-pointer group"
                        >
                          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-[#272727] mb-2 relative">
                            <img
                              src={
                                r.image ||
                                r.coverImage?.large ||
                                activeThumbnail
                              }
                              alt={
                                r.title?.english || r.title?.romaji || r.title
                              }
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {r.score && (
                              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {r.score}%
                              </div>
                            )}
                          </div>
                          <h4 className="text-[#f1f1f1] text-sm font-semibold line-clamp-2 group-hover:text-[#3ea6ff] transition-colors">
                            {r.title?.english ||
                              r.title?.romaji ||
                              r.title ||
                              "Unknown Anime"}
                          </h4>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#aaaaaa] text-sm col-span-full">
                        No recommendations available.
                      </p>
                    )}
                  </div>
                )}

                {/* SEASONS TAB */}
                {activeTab === "seasons" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {seasonsList.length > 0 ? (
                      seasonsList.map((s: any, idx: number) => (
                        <div
                          key={s.id || idx}
                          onClick={() => handleAnimeChange(s.id)}
                          className="cursor-pointer group"
                        >
                          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-[#272727] mb-2 relative">
                            <img
                              src={
                                s.posterProxied ||
                                s.poster ||
                                s.image ||
                                activeThumbnail
                              }
                              alt={s.title || s.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <h4 className="text-[#f1f1f1] text-sm font-semibold line-clamp-2 group-hover:text-[#3ea6ff] transition-colors">
                            {s.title || s.name || "Unknown Season"}
                          </h4>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#aaaaaa] text-sm col-span-full">
                        No additional seasons found.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
