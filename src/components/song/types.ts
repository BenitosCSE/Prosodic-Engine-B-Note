import { ProsodyMetrics } from "../../utils/prosodyEngine";
import { SongSettings } from "../../hooks/useSongSettings";
import { MetatagChip, MetatagFormatMode } from "./sunoMetatagsData";

export interface Row {
  id: string;
  text: string;
  isSection: boolean;
  metatags?: MetatagChip[];
}

export interface SongContent {
  settings: SongSettings;
  rows: Row[];
  dictionary?: Record<string, number>;
  globalStyleChips?: MetatagChip[];
  excludeStyleChips?: MetatagChip[];
  musicalKey?: string;
  lockKeyBpmInStyle?: boolean;
  useMaxModeHeader?: boolean;
  metatagFormatMode?: MetatagFormatMode;
}
