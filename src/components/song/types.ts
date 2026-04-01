import { ProsodyMetrics } from "../../utils/prosodyEngine";
import { SongSettings } from "../../hooks/useSongSettings";

export interface Row {
  id: string;
  text: string;
  isSection: boolean;
  blockId: string | null;
}

export interface Block {
  id: string;
  label: string;
  order: number;
}

export interface SongContent {
  settings: SongSettings;
  blocks: Block[];
  rows: Row[];
  dictionary?: Record<string, number>;
}
