import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Sparkles,
  RefreshCw,
  Copy,
  BookmarkPlus,
  Layers,
  Check,
  ChevronRight,
  Star,
} from 'lucide-react';
import {
  MetatagChip,
  MetatagCategoryKey,
  MetatagSubcategory,
  CustomMetatagStore,
  SUNO_SUBCATEGORIES,
  CATEGORY_META,
  getSuggestedSubcategory,
  getNextModifierVariant,
  formatMetatagLine,
} from './sunoMetatagsData';

interface MetatagInlineBuilderProps {
  sectionHeader: string;
  chips: MetatagChip[];
  isMetatagMode: boolean;
  customStore: CustomMetatagStore;
  previousSameSectionChips?: MetatagChip[] | null;
  previousAnySectionChips?: MetatagChip[] | null;
  onChangeChips: (nextChips: MetatagChip[]) => void;
  onAddCustomTagToStore: (
    subcategoryId: string,
    newTagLabel: string,
    parentTagLabel?: string
  ) => void;
  onSaveChainPreset: (name: string, chips: MetatagChip[]) => void;
}

const CATEGORY_ORDER: MetatagCategoryKey[] = ['genre', 'mood', 'style', 'vocal', 'fx'];

const MetatagInlineBuilder: React.FC<MetatagInlineBuilderProps> = ({
  sectionHeader,
  chips,
  isMetatagMode,
  customStore,
  previousSameSectionChips,
  previousAnySectionChips,
  onChangeChips,
  onAddCustomTagToStore,
  onSaveChainPreset,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // If editingIndex !== null, clicking a tag in the picker replaces that capsule in-place
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string>('genre_core');
  const [showPresetsTab, setShowPresetsTab] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedLine = formatMetatagLine(chips, customStore.formatMode);

  // Close picker on outside click
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
        setEditingIndex(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isPickerOpen]);

  // Close picker when leaving metatag mode
  useEffect(() => {
    if (!isMetatagMode) {
      setIsPickerOpen(false);
      setEditingIndex(null);
      setShowSavePresetInput(false);
    }
  }, [isMetatagMode]);

  const openSmartPlusPicker = () => {
    const suggested = getSuggestedSubcategory(sectionHeader, chips, customStore);
    setActiveSubcategoryId(suggested.id);
    setEditingIndex(null);
    setShowPresetsTab(false);
    setManualInput('');
    setIsPickerOpen(true);
  };

  const openSwapPickerForIndex = (idx: number) => {
    const target = chips[idx];
    if (!target) return;
    setActiveSubcategoryId(target.subcategoryId || 'genre_core');
    setEditingIndex(idx);
    setShowPresetsTab(false);
    setManualInput('');
    setIsPickerOpen(true);
  };

  const activeSubcategory: MetatagSubcategory =
    SUNO_SUBCATEGORIES.find(s => s.id === activeSubcategoryId) || SUNO_SUBCATEGORIES[0];

  // Merge custom user tags for this subcategory + parent-linked custom tags at the top
  const lastParentLabel =
    editingIndex !== null
      ? editingIndex > 0
        ? chips[editingIndex - 1]?.label
        : undefined
      : chips[chips.length - 1]?.label;

  const customTagsForSub = customStore.customTagsBySubcategory[activeSubcategory.id] || [];
  const linkedCustomTags = lastParentLabel
    ? customStore.parentToCustomTags[lastParentLabel.toUpperCase()] || []
    : [];

  const allAvailableTags = React.useMemo(() => {
    const seen = new Set<string>();
    const result: { label: string; isCustom: boolean; isLinked: boolean }[] = [];

    linkedCustomTags.forEach(t => {
      const upper = t.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        result.push({ label: t, isCustom: true, isLinked: true });
      }
    });

    customTagsForSub.forEach(t => {
      const upper = t.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        result.push({ label: t, isCustom: true, isLinked: false });
      }
    });

    activeSubcategory.tags.forEach(t => {
      const upper = t.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        result.push({ label: t, isCustom: false, isLinked: false });
      }
    });

    if (manualInput.trim()) {
      const q = manualInput.trim().toLowerCase();
      return result.filter(item => item.label.toLowerCase().includes(q));
    }

    return result;
  }, [activeSubcategory, customTagsForSub, linkedCustomTags, manualInput]);

  const handleSelectTag = (
    label: string,
    isCustom: boolean,
    keepSameSubcategory: boolean = false
  ) => {
    const newChip: MetatagChip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: label.replace(/[\[\]]/g, '').trim(),
      category: activeSubcategory.category,
      subcategoryId: activeSubcategory.id,
      isCustom,
    };

    if (editingIndex !== null) {
      // In-place swap of existing capsule
      const updated = [...chips];
      updated[editingIndex] = newChip;
      onChangeChips(updated);
      setIsPickerOpen(false);
      setEditingIndex(null);
      return;
    }

    const nextChips = [...chips, newChip];
    onChangeChips(nextChips);
    setManualInput('');

    if (!keepSameSubcategory) {
      // Automatically advance dropdown to the next semantically connected subcategory!
      const nextSuggested = getSuggestedSubcategory(sectionHeader, nextChips, customStore);
      setActiveSubcategoryId(nextSuggested.id);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualInput.replace(/[\[\]]/g, '').trim();
    if (!clean) return;

    // 1. Save into self-learning subcategory store
    onAddCustomTagToStore(activeSubcategory.id, clean, lastParentLabel);

    // 2. Add or swap chip in the current section
    handleSelectTag(clean, true, false);
  };

  const handleRemoveChip = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chips.filter((_, i) => i !== idx);
    onChangeChips(updated);
    if (editingIndex === idx) {
      setIsPickerOpen(false);
      setEditingIndex(null);
    }
  };

  const handleCycleModifier = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = chips[idx];
    if (!current) return;
    const nextVariant = getNextModifierVariant(current.label);
    if (!nextVariant) return;
    const updated = [...chips];
    updated[idx] = { ...current, label: nextVariant };
    onChangeChips(updated);
  };

  const handleSavePresetConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (chips.length === 0) return;
    const name =
      presetNameInput.trim() ||
      chips
        .slice(0, 3)
        .map(c => c.label)
        .join(' + ');
    onSaveChainPreset(name, chips);
    setPresetNameInput('');
    setShowSavePresetInput(false);
  };

  // In normal lyric editing mode: only show a super compact read-only bracketed line if metatags exist
  if (!isMetatagMode) {
    if (!formattedLine) return null;
    return (
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-wider text-orange-accent/85 uppercase select-text">
          {formattedLine}
        </span>
      </div>
    );
  }

  // In Metatag Mode: Interactive Thin Window-Capsule Chain Builder
  return (
    <div
      ref={containerRef}
      onClick={e => e.stopPropagation()}
      className="mt-1.5 pt-1.5 border-t border-orange-accent/25 select-none"
    >
      {/* Thin Window-Capsules Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip, idx) => {
          const meta = CATEGORY_META[chip.category] || CATEGORY_META.style;
          const canCycle = Boolean(getNextModifierVariant(chip.label));
          const isBeingEdited = isPickerOpen && editingIndex === idx;

          return (
            <React.Fragment key={chip.id}>
              {/* Thin Matte Window Card (inspired by user's screenshot) */}
              <div
                onClick={() => openSwapPickerForIndex(idx)}
                className={`group/chip relative flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#111215] border transition-all cursor-pointer ${
                  isBeingEdited
                    ? 'border-orange-accent ring-1 ring-orange-accent/50 bg-orange-accent/10'
                    : `${meta.borderClass} ${meta.glowClass}`
                }`}
                title="Клік — замінити тег у цій категорії"
              >
                <div className="flex flex-col leading-none min-w-0">
                  <div className="flex items-center gap-1">
                    {chip.isCustom && (
                      <Star size={9} className="text-orange-accent fill-orange-accent shrink-0" />
                    )}
                    <span className="text-[11px] sm:text-xs font-extrabold text-gray-100 uppercase tracking-wider whitespace-nowrap">
                      {chip.label}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono uppercase tracking-widest text-gray-500 mt-0.5">
                    {meta.shortLabel}
                  </span>
                </div>

                {/* Micro-modifier cycle button if supported */}
                {canCycle && (
                  <button
                    type="button"
                    onClick={e => handleCycleModifier(idx, e)}
                    className="p-0.5 rounded bg-white/5 hover:bg-orange-accent/20 text-gray-400 hover:text-orange-accent transition-colors cursor-pointer"
                    title="Змінити параметр (1 Sec / 2 Sec / 3 Sec тощо)"
                  >
                    <RefreshCw size={10} />
                  </button>
                )}

                {/* Remove capsule button */}
                <button
                  type="button"
                  onClick={e => handleRemoveChip(idx, e)}
                  className="p-0.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Прибрати частину тегу"
                >
                  <X size={11} />
                </button>
              </div>

              {idx < chips.length - 1 && (
                <ChevronRight size={11} className="text-gray-600 shrink-0 -mx-0.5" />
              )}
            </React.Fragment>
          );
        })}

        {/* Sequential [ + ] Button */}
        <button
          type="button"
          onClick={openSmartPlusPicker}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
            isPickerOpen && editingIndex === null
              ? 'bg-orange-accent text-black border-orange-accent shadow-[0_0_15px_rgba(255,107,0,0.4)]'
              : 'bg-[#141519] hover:bg-orange-accent/15 border-orange-accent/40 text-orange-accent'
          }`}
          title="Додати наступну частину метатегу (авто-підбір за змістом)"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>{chips.length === 0 ? 'Додати метатег' : 'Далі'}</span>
        </button>

        {/* Quick 1-Click Inherit from previous same section or block above */}
        {chips.length === 0 && previousSameSectionChips && previousSameSectionChips.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onChangeChips(
                previousSameSectionChips.map(c => ({
                  ...c,
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                }))
              )
            }
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] font-bold text-gray-300 transition-all cursor-pointer"
            title="Скопіювати ланцюжок метатегів з попереднього такого ж блоку"
          >
            <Copy size={11} className="text-orange-accent" />
            <span>Як у попередньому {sectionHeader}</span>
          </button>
        )}

        {chips.length === 0 &&
          (!previousSameSectionChips || previousSameSectionChips.length === 0) &&
          previousAnySectionChips &&
          previousAnySectionChips.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onChangeChips(
                  previousAnySectionChips.map(c => ({
                    ...c,
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  }))
                )
              }
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] font-bold text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
              title="Скопіювати ланцюжок з попередньої секції"
            >
              <Copy size={11} className="text-orange-accent/80" />
              <span>Клонувати з блоку вище</span>
            </button>
          )}

        {/* Save current chain as reusable preset */}
        {chips.length >= 2 && (
          <button
            type="button"
            onClick={() => setShowSavePresetInput(prev => !prev)}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-orange-accent/15 border border-white/10 hover:border-orange-accent/40 text-gray-400 hover:text-orange-accent transition-all cursor-pointer"
            title="Зберегти весь ланцюжок як власний пресет"
          >
            <BookmarkPlus size={13} />
          </button>
        )}
      </div>

      {/* Save Preset Inline Input */}
      {showSavePresetInput && (
        <form onSubmit={handleSavePresetConfirm} className="mt-2 flex items-center gap-1.5">
          <input
            type="text"
            value={presetNameInput}
            onChange={e => setPresetNameInput(e.target.value)}
            placeholder="Назва зв'язки (напр. Epic Orchestral Drop)..."
            className="bg-black/60 border border-orange-accent/40 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none flex-grow max-w-xs"
            autoFocus
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded-lg bg-orange-accent text-black text-[10px] font-bold uppercase cursor-pointer"
          >
            Зберегти пресет
          </button>
        </form>
      )}

      {/* Live Bracketed Output Line (What Suno sees right under [SECTION]) */}
      {formattedLine && (
        <div className="mt-1.5 flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-black/50 border border-white/5">
          <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-wider text-orange-accent uppercase truncate">
            {formattedLine}
          </span>
          <span className="text-[8px] uppercase tracking-widest text-gray-500 shrink-0">
            Suno Line
          </span>
        </div>
      )}

      {/* Cascading Smart Dropdown Popover */}
      {isPickerOpen && (
        <div className="mt-2 p-2.5 sm:p-3 rounded-xl bg-[#0e0f12] border border-orange-accent/35 shadow-[0_14px_40px_rgba(0,0,0,0.9)] z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Top Header: Context Info + Category Branch Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-orange-accent shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-200">
                {editingIndex !== null
                  ? `Заміна капсули #${editingIndex + 1}`
                  : `${activeSubcategory.title} (${activeSubcategory.uaHint})`}
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {CATEGORY_ORDER.map(catKey => {
                const catMeta = CATEGORY_META[catKey];
                const isCatActive = !showPresetsTab && activeSubcategory.category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => {
                      setShowPresetsTab(false);
                      const firstSub = SUNO_SUBCATEGORIES.find(s => s.category === catKey);
                      if (firstSub) setActiveSubcategoryId(firstSub.id);
                    }}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      isCatActive
                        ? `${catMeta.badgeClass} border-current`
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {catMeta.shortLabel}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowPresetsTab(true)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  showPresetsTab
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                    : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Layers size={10} />
                <span>Зв'язки</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPickerOpen(false);
                  setEditingIndex(null);
                }}
                className="p-1 text-gray-500 hover:text-white cursor-pointer ml-1"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {showPresetsTab ? (
            /* Saved Chain Combos Tab */
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {customStore.chainPresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const cloned: MetatagChip[] = preset.chips.map(c => ({
                      ...c,
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    }));
                    onChangeChips([...chips, ...cloned]);
                    setIsPickerOpen(false);
                  }}
                  className="w-full p-2 rounded-lg bg-[#15161a] hover:bg-orange-accent/10 border border-white/10 hover:border-orange-accent/40 text-left transition-all cursor-pointer flex flex-col gap-1"
                >
                  <span className="text-xs font-bold text-orange-accent">{preset.name}</span>
                  <span className="text-[10px] font-mono text-gray-400 uppercase truncate">
                    {preset.chips.map(c => `[${c.label.toUpperCase()}]`).join(' → ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Subcategory Pills within the selected Category */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mb-2 pb-1">
                {SUNO_SUBCATEGORIES.filter(s => s.category === activeSubcategory.category).map(
                  sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveSubcategoryId(sub.id)}
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                        sub.id === activeSubcategory.id
                          ? 'bg-white/15 text-white border border-white/25'
                          : 'bg-white/[0.03] text-gray-400 hover:text-gray-200 border border-transparent'
                      }`}
                    >
                      {sub.title}
                    </button>
                  )
                )}
              </div>

              {/* Search / Self-Learning Manual Tag Input */}
              <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5 mb-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder={`Пошук або впиши власний тег у "${activeSubcategory.title}"...`}
                  className="bg-black/60 border border-white/15 focus:border-orange-accent/60 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none flex-grow"
                />
                {manualInput.trim() && (
                  <button
                    type="submit"
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-accent hover:bg-orange-500 text-black text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                    title="Додати тег у ланцюжок і назавжди зберегти в цю підкатегорію"
                  >
                    <Plus size={12} />
                    <span>В базу + Додати</span>
                  </button>
                )}
              </form>

              {/* Grid of Thin Window-Cards to Pick From */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-0.5">
                {allAvailableTags.map(item => {
                  const alreadyInRow = chips.some(
                    c => c.label.toUpperCase() === item.label.toUpperCase()
                  );
                  return (
                    <div
                      key={item.label}
                      className={`group flex items-center justify-between rounded-lg border px-2 py-1.5 transition-all ${
                        alreadyInRow
                          ? 'bg-orange-accent/15 border-orange-accent/50 text-orange-accent'
                          : 'bg-[#15171c] hover:bg-[#1c1f26] border-white/10 hover:border-orange-accent/40 text-gray-200'
                      }`}
                    >
                      {/* Main click: Selects tag and cascades to the NEXT logical subcategory */}
                      <button
                        type="button"
                        onClick={() => handleSelectTag(item.label, item.isCustom, false)}
                        className="flex-grow text-left min-w-0 pr-1 cursor-pointer"
                        title="Клік — обрати й перейти до наступної підкатегорії"
                      >
                        <div className="flex items-center gap-1">
                          {item.isCustom && (
                            <Star
                              size={9}
                              className="text-orange-accent fill-orange-accent shrink-0"
                            />
                          )}
                          <span className="text-[11px] font-bold uppercase tracking-wide truncate block">
                            {item.label}
                          </span>
                        </div>
                      </button>

                      {/* Multi-pick [+] button: Adds tag WITHOUT leaving the current subcategory */}
                      {editingIndex === null && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectTag(item.label, item.isCustom, true);
                          }}
                          className="shrink-0 p-1 rounded bg-white/5 hover:bg-orange-accent hover:text-black text-gray-400 transition-colors cursor-pointer"
                          title="Додати і залишитись у цьому ж списку (мульти-вибір)"
                        >
                          {alreadyInRow ? <Check size={10} /> : <Plus size={10} />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MetatagInlineBuilder;
