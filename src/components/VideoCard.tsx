import { useState, useRef, useEffect, useId } from "react";
import type { Episode } from "../types";
import { resolveVideo } from "../api";
import Hls from "hls.js";

// 🚦 GLOBAL VIDEO MANAGER
class VideoManager {
  static visibleItems = new Set<string>();
  static activeItem: string | null = null;
  static listeners = new Map<string, (isActive: boolean) => void>();
  static timeout: any = null;

  static register(id: string, callback: (isActive: boolean) => void) {
    this.listeners.set(id, callback);
    callback(id === this.activeItem);
  }

  static unregister(id: string) {
    this.listeners.delete(id);
    this.visibleItems.delete(id);
    if (this.activeItem === id) {
      this.activeItem = null;
      this.updateActive();
    }
  }

  static setVisible(id: string, isVisible: boolean) {
    if (isVisible) this.visibleItems.add(id);
    else this.visibleItems.delete(id);
    this.updateActive();
  }

  static updateActive() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      const firstVisible = Array.from(this.visibleItems)[0] || null;
      if (this.activeItem !== firstVisible) {
        this.activeItem = firstVisible;
        for (const [id, callback] of this.listeners.entries()) {
          callback(id === this.activeItem);
        }
      }
    }, 50);
  }
}

interface Props {
  item: Episode;
  onClick: (item: Episode) => void;
}

export default function VideoCard({ item, onClick }: Props) {
  const cardId = useId();
  const [hovered, setHovered] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : true,
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    VideoManager.register(cardId, (status) => setIsActive(status));
    return () => VideoManager.unregister(cardId);
  }, [cardId]);

  useEffect(() => {
    if (!containerRef.current || !isMobile) {
      VideoManager.setVisible(cardId, false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => VideoManager.setVisible(cardId, entry.isIntersecting),
      {
        threshold: 0.8,
        rootMargin: "-10% 0px -25% 0px",
      },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [cardId, isMobile]);

  // Video Stream Setup
  useEffect(() => {
    if (!previewUrl || !videoRef.current) return;
    const video = videoRef.current;
    setIsReady(false);

    // Because the Proxy URL looks like ".../hls-proxy?url=...m3u8", we check if it INCLUDES .m3u8
    if (previewUrl.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 5, enableWorker: true });
      hls.loadSource(previewUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true);
        setLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setLoading(false);
        }
      });

      hlsRef.current = hls;
    } else {
      // If it's an MP4, it hits this block directly
      video.src = previewUrl;
      video.onloadeddata = () => {
        setIsReady(true);
        setLoading(false);
      };

      video.onerror = () => {
        setLoading(false);
      };
    }
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [previewUrl]);

  // Autoplay Trigger Logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    const shouldPlay = isMobile ? isActive : hovered;
    if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [hovered, isActive, isReady, isMobile]);

  useEffect(() => {
    if (isMobile && isActive && !previewUrl && !loading) {
      fetchPreview();
    }
  }, [isActive, isMobile]);

  const fetchPreview = async () => {
    if (!item?.anime_session || !item?.session || loading) return;
    setLoading(true);
    try {
      const data = await resolveVideo(item.anime_session, item.session);

      // 🔥 PRIORITIZE THE MP4 DOWNLOAD LINK OVER THE M3U8 STREAM
      const streamUrl =
        data.sub?.download ||
        data.dub?.download ||
        data.sub?.url ||
        data.dub?.url ||
        null;

      if (streamUrl) {
        if (streamUrl.includes(".m3u8")) {
          // Fallback just in case MP4 wasn't found
          const BACKEND_URL = "http://localhost:7860";
          setPreviewUrl(
            `${BACKEND_URL}/hls-proxy?url=${encodeURIComponent(streamUrl)}`,
          );
        } else {
          // We got the MP4 link! No proxy required for this assignment.
          setPreviewUrl(streamUrl);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (isMobile) return;
    setHovered(true);
    if (!previewUrl) fetchPreview();
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setHovered(false);
    setIsMuted(true);
  };

  return (
    <div
      ref={containerRef}
      className={`
        relative p-2.5 rounded-xl transition-all duration-300 ease-in-out cursor-pointer
        ${!isMobile && hovered ? "bg-[#1f1f1f] shadow-xl" : "bg-transparent"}
      `}
      onClick={() => onClick(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
        <img
          src={`https://images.weserv.nl/?url=${encodeURIComponent(item?.snapshot || "")}`}
          alt="thumb"
          className={`
            absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300
            ${isReady && (isMobile ? isActive : hovered) ? "opacity-0" : "opacity-100"}
          `}
        />

        {previewUrl && (
          <video
            ref={videoRef}
            muted={isMuted}
            loop
            playsInline
            className={`
              absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300
              ${isReady && (isMobile ? isActive : hovered) ? "opacity-100" : "opacity-0"}
            `}
          />
        )}

        {isReady && (isMobile ? isActive : hovered) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute top-2 right-2 z-30 p-2 bg-black/70 text-white rounded-md transition-all active:scale-90"
          >
            {isMuted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.063.922-2.063 2.063v3.875c0 1.141.922 2.063 2.063 2.063h1.932l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.545 8.47a.75.75 0 0 1 1.06 0L21 9.864l1.394-1.394a.75.75 0 1 1 1.06 1.06L22.06 10.924l1.394 1.394a.75.75 0 1 1-1.06 1.06L21 11.985l-1.394 1.394a.75.75 0 1 1-1.06-1.06l1.394-1.394-1.394-1.394a.75.75 0 0 1 0-1.06Z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.063.922-2.063 2.063v3.875c0 1.141.922 2.063 2.063 2.063h1.932l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06Z" />
                <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
              </svg>
            )}
          </button>
        )}

        {loading && !isReady && (isMobile ? isActive : hovered) && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
            <div className="w-7 h-7 border-[3px] border-white/20 border-t-red-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="mt-3 px-0.5">
        <h3
          className={`text-[14px] font-bold line-clamp-2 leading-tight transition-colors duration-200
          ${!isMobile && hovered ? "text-[#ff0000]" : "text-[#f1f1f1]"}`}
          style={{ fontFamily: "Roboto, Arial, sans-serif" }}
        >
          {item?.anime_title}
        </h3>
        <p className="text-[11px] text-[#aaaaaa] mt-1.5 uppercase tracking-wider font-semibold">
          Episode {item?.episode}
        </p>
      </div>
    </div>
  );
}
