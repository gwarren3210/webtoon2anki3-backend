// TypeScript interfaces for MAL series data

export interface MalSeries {
  id: string; // UUID
  malId: number;
  type: 'anime' | 'manga';
  title: string;
  alternativeTitles: MalAlternativeTitles;
  mainPicture: string;
  startDate?: string;
  endDate?: string;
  synopsis?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  numListUsers?: number;
  numScoringUsers?: number;
  nsfw?: string;
  createdAt?: string;
  updatedAt?: string;
  mediaType?: string;
  status?: string;
  genres?: MalGenre[];
  myListStatus?: Record<string, unknown>;
  numEpisodes?: number;
  numVolumes?: number;
  numChapters?: number;
  startSeason?: Record<string, unknown>;
  broadcast?: Record<string, unknown>;
  source?: string;
  averageEpisodeDuration?: number;
  rating?: string;
  pictures?: MalPicture[];
  background?: string;
  relatedAnime?: MalRelated[];
  relatedManga?: MalRelated[];
  recommendations?: MalRecommendation[];
  studios?: MalStudio[];
  statistics?: Record<string, unknown>;
  authors?: MalAuthor[];
  serialization?: MalSerialization[];
  insertedAt: string;
}

export interface MalAlternativeTitles {
  en?: string;
  ja?: string;
  synonyms?: string[];
}

export interface MalGenre {
  id: number;
  name: string;
}

export interface MalPicture {
  large: string;
  medium: string;
}

export interface MalRelated {
  id: number;
  title: string;
  relation_type: string;
  type: string;
}

export interface MalRecommendation {
  id: number;
  title: string;
  type: string;
}

export interface MalStudio {
  id: number;
  name: string;
}

export interface MalAuthor {
  first_name: string;
  last_name: string;
}

export interface MalSerialization {
  name: string;
} 