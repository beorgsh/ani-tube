export interface Episode {
  anime_session: string;
  session: string;
  episode: string;
  anime_title: string;
  snapshot: string;
}

export interface StreamInfo {
  url: string;
  download: string;
  resolution: string;
  fansub?: string;
}

export interface ResolveResponse {
  anime?: string;
  episode?: string;
  anime_name?: string;
  episode_num?: string;
  sub?: StreamInfo | null; // Added ? and null
  dub?: StreamInfo | null; // Added ? and null
  error?: string;
}
