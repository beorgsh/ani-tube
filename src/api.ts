import axios from "axios";
import type { Episode, ResolveResponse } from "./types";

const BASE = "https://catapang1989-aniscrap.hf.space";

export const getLatest = async (page: number = 1): Promise<Episode[]> => {
  const res = await axios.get(`${BASE}/latest?p=${page}`);
  const data = res.data;
  return Array.isArray(data) ? data : data.data || data.results || [];
};

export const resolveVideo = async (
  anime_session: string,
  session: string,
): Promise<ResolveResponse> => {
  const res = await axios.get<ResolveResponse>(
    `${BASE}/resolve/${anime_session}/${session}`,
  );
  return res.data;
};
// 🔥 CHANGED: Now calls the `/info/` endpoint to get the ID AND all the anime details!
export const getAnimeInfo = async (anime_session: string) => {
  const res = await axios.get(`${BASE}/info/${anime_session}`);
  return res.data;
};

// 🔥 Wrapped with a CORS proxy
export const getHiAnimeEpisodes = async (anilistId: string | number) => {
  const targetUrl = encodeURIComponent(
    `https://anilistmapper.vercel.app/hianime/${anilistId}`,
  );
  const res = await axios.get(`https://corsproxy.io/?${targetUrl}`);
  return res.data;
};

// 🔥 Wrapped with a CORS proxy
export const getAnimePaheEpisodes = async (anilistId: string | number) => {
  const targetUrl = encodeURIComponent(
    `https://anilistmapper.vercel.app/animepahe/map/${anilistId}`,
  );
  const res = await axios.get(`https://corsproxy.io/?${targetUrl}`);
  return res.data;
};

// 🔥 Search Anime by query
export const searchAnime = async (query: string) => {
  if (!query) return [];
  const res = await axios.get(`${BASE}/search?q=${encodeURIComponent(query)}`);
  return Array.isArray(res.data) ? res.data : [];
};
