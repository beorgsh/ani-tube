export interface Episode {
  id: number;
  anime_id: number;
  anime_title: string;
  anime_session: string;
  episode: number;
  snapshot: string;
  session: string;
}

export interface ResolveResponse {
  sub?: {
    download: string;
    url: string;
  };
}
