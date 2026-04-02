import { ProsodyMetrics } from "../../utils/prosodyEngine";
import { SongSettings } from "../../hooks/useSongSettings";

export interface Row {
  id: string;
  text: string;
  isSection: boolean;
}

export interface SongContent {
  settings: SongSettings;
  rows: Row[];
  dictionary?: Record<string, number>;
}
