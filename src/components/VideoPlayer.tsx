import React, { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "./youtube-theme.css"; // ✅ Update this path to match where you saved the CSS
import type Player from "video.js/dist/types/player";

interface VideoPlayerProps {
  options: any;
  onReady?: (player: Player) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  options,
  onReady,
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    const videoJsOptions = {
      controls: true,
      fill: true,
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      userActions: {
        hotkeys: true,
      },
      controlBar: {
        children: [
          "progressControl",
          "playToggle",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "customControlSpacer",
          "subsCapsButton",
          "playbackRateMenuButton",
          "pictureInPictureToggle",
          "fullscreenToggle",
        ],
      },
      ...options,
    };

    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video-js");

      videoElement.classList.add(
        "vjs-big-play-centered",
        "vjs-theme-youtube",
        "w-full",
        "h-full",
      );
      videoRef.current.appendChild(videoElement);

      const player = (playerRef.current = videojs(
        videoElement,
        videoJsOptions,
        () => {
          if (onReady) onReady(player);
        },
      ));
    } else if (playerRef.current) {
      const player = playerRef.current;
      player.autoplay(options.autoplay);
      player.src(options.sources);
    }
  }, [options, videoRef, onReady]);

  useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      data-vjs-player
      className="w-full h-full bg-black rounded-xl overflow-hidden shadow-lg"
    >
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
};
