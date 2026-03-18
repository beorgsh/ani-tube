// src/components/Header.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, ArrowLeft, X, Play, Loader2 } from "lucide-react";
import { searchAnime } from "../api";

const CATEGORIES = [
  "All",
  "Recent",
  "Popular",
  "Movies",
  "Trending",
  "Action",
  "Romance",
  "Sci-Fi",
  "Fantasy",
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("All");

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Mobile Scroll Lock Logic when searching
  useEffect(() => {
    if (isSearching) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.documentElement.style.overflow = "hidden";

      // Auto-focus input when search is opened
      setTimeout(() => inputRef.current?.focus(), 100);

      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.documentElement.style.overflow = "";
      };
    }
  }, [isSearching]);

  // Handle Header Scroll shadow
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // API Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsLoading(true);
        try {
          const data = await searchAnime(searchQuery);
          // Adjust based on API structure
          setResults(Array.isArray(data) ? data : (data as any).results || []);
        } catch (err) {
          console.error("Search failed", err);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleSearch = () => {
    setIsSearching(!isSearching);
    if (!isSearching) {
      setSearchQuery("");
      setResults([]);
    }
  };

  return (
    <>
      {/* --- MAIN HEADER (Always solid dark background to prevent "double merge" content bleed) --- */}
      <div
        className={`fixed top-0 inset-x-0 z-[110] bg-neutral-950 transition-all duration-300 ${
          isScrolled
            ? "shadow-lg shadow-black/50 border-b border-white/5"
            : "border-b border-transparent"
        }`}
      >
        <header className="h-14 flex items-center px-3 sm:px-4 max-w-[2000px] mx-auto w-full">
          {isSearching ? (
            /* --- SEARCH MODE TOP BAR --- */
            <div className="flex items-center w-full gap-2 animate-in fade-in duration-200">
              <button
                onClick={toggleSearch}
                className="p-2 hover:bg-white/10 rounded-full text-neutral-200"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search anime..."
                  className="w-full bg-white/5 text-white pl-4 pr-10 py-2 rounded-full outline-none border border-white/10 focus:border-white/20 transition-all"
                />
                <div className="absolute right-4">
                  {isLoading ? (
                    <Loader2 size={18} className="text-red-500 animate-spin" />
                  ) : (
                    <Search size={18} className="text-neutral-400" />
                  )}
                </div>
              </div>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    inputRef.current?.focus();
                  }}
                  className="p-2 rounded-full text-neutral-400 hover:text-white"
                >
                  <X size={26} />
                </button>
              )}
            </div>
          ) : (
            /* --- DEFAULT TOP BAR --- */
            <div className="flex items-center justify-between w-full h-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full hover:bg-white/10 text-neutral-100 hidden sm:block">
                  <Menu size={24} />
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <div className="w-[30px] h-[22px] bg-[#FF0000] rounded-[6px] flex items-center justify-center shadow-lg shadow-red-600/20">
                    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
                  </div>
                  <span
                    className="text-[22px] font-bold text-white tracking-tighter"
                    style={{
                      fontFamily: "'Roboto Condensed', sans-serif",
                      letterSpacing: "-1.5px",
                    }}
                  >
                    AniTube
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleSearch}
                  className="p-2 text-neutral-100 hover:bg-white/10 rounded-full"
                >
                  <Search size={22} />
                </button>
                <div className="ml-2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs border border-white/10 overflow-hidden">
                  J
                </div>
              </div>
            </div>
          )}
        </header>

        {/* --- HORIZONTAL TAB LIST (Completely unmounted during search phase) --- */}
        {!isSearching && (
          <nav className="w-full pb-2">
            <div
              className="flex items-center gap-3 px-4 overflow-x-auto no-scrollbar scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`
                    whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${
                      activeTab === cat
                        ? "bg-white text-black"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>

      {/* --- SEARCH RESULTS OVERLAY --- */}
      {isSearching && (
        <div className="fixed inset-0 z-[105] bg-neutral-950 pt-16 px-2 pb-20 h-[100dvh] overflow-y-auto">
          {/* Default State: Before typing */}
          {!isLoading && searchQuery.length <= 1 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-neutral-500">
              <Search size={40} className="mb-4 opacity-20" />
              <p>Type to search anime...</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center mt-20 text-neutral-400">
              <Loader2 size={32} className="animate-spin mb-4 text-red-500" />
              <p>Searching for "{searchQuery}"...</p>
            </div>
          )}

          {/* Empty/No Results State */}
          {!isLoading && searchQuery.length > 1 && results.length === 0 && (
            <div className="text-center mt-20 text-neutral-400">
              No results found for "{searchQuery}"
            </div>
          )}

          {/* Search Results Mapping */}
          {!isLoading && results.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              {results.map((anime: any, idx: number) => (
                <button
                  key={anime.id || idx}
                  onClick={() => {
                    toggleSearch();
                    navigate(`/anime/${anime.id}`); // Adjust route path if necessary
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-colors w-full text-left"
                >
                  <img
                    src={
                      anime.image ||
                      anime.cover ||
                      "https://via.placeholder.com/100x150"
                    }
                    alt="poster"
                    className="w-14 h-20 object-cover rounded-md bg-neutral-800 shrink-0"
                  />
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight mb-1">
                      {typeof anime.title === "string"
                        ? anime.title
                        : anime.title?.english ||
                          anime.title?.romaji ||
                          anime.name}
                    </h3>
                    <p className="text-neutral-400 text-[11px] font-medium tracking-wide uppercase">
                      {anime.releaseDate || anime.year || "N/A"} •{" "}
                      {anime.type || anime.format || "TV"}
                    </p>
                  </div>
                  <Play size={20} className="text-neutral-500 shrink-0 mr-2" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global CSS to hide scrollbar for the tab bar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
};

export default Header;
