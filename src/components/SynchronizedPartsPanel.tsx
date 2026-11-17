import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Cpu,
  EyeOff,
  Info,
  Search,
  X,
} from 'lucide-react';
import {
  EDITORIAL_CHAPTERS,
  evaluateScrollSequence,
  getComponentSpec,
  isIllustrativeMechanicalSpec,
} from '../utils/explosionGroups';

export type PartsCategoryFilterId =
  | 'all'
  | 'bodywork'
  | 'wheels_brakes'
  | 'cabin_glass'
  | 'chassis_suspension'
  | 'v12_powertrain';

const CATEGORY_FILTERS: ReadonlyArray<{
  id: PartsCategoryFilterId;
  label: string;
}> = [
  { id: 'all', label: 'All (32)' },
  { id: 'v12_powertrain', label: 'V12 Powertrain' },
  { id: 'chassis_suspension', label: 'Chassis & Susp.' },
  { id: 'bodywork', label: 'Body & Aero' },
  { id: 'wheels_brakes', label: 'Wheels & Brakes' },
  { id: 'cabin_glass', label: 'Cabin & Glass' },
];

export interface SynchronizedPartsPanelProps {
  scrollProgress: number;
  reducedMotion: boolean;
  structureMode: boolean;
  selectedGroup: string | null;
  onSelectGroup: (nodeName: string | null) => void;
  onBackToCar: () => void;
  onJumpToProgress: (targetProgress: number) => void;
}

export const SynchronizedPartsPanel: React.FC<SynchronizedPartsPanelProps> = ({
  scrollProgress,
  reducedMotion,
  structureMode,
  selectedGroup,
  onSelectGroup,
  onBackToCar,
  onJumpToProgress,
}) => {
  const summary = evaluateScrollSequence(scrollProgress);
  const pct = Math.round(summary.scrollProgress * 100);
  const selectedSpec = getComponentSpec(selectedGroup);
  const selectedIsMechanical = isIllustrativeMechanicalSpec(selectedSpec);
  const selectedProgressItem = summary.allComponents.find(
    (g) => g.nodeName === selectedGroup,
  );

  // Collapsed by default on all viewports so the larger SP3 remains dominant
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] =
    useState<PartsCategoryFilterId>('all');

  const filteredComponents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.allComponents.filter((item) => {
      if (activeCategory !== 'all') {
        if (activeCategory === 'cabin_glass') {
          if (
            item.category !== 'glazing_mirrors' &&
            item.nodeName !== 'Cabin' &&
            item.nodeName !== 'Underbody_and_trim'
          ) {
            return false;
          }
        } else if (activeCategory === 'wheels_brakes') {
          if (item.category !== 'wheels' && item.category !== 'brakes') {
            return false;
          }
        } else if (item.category !== activeCategory) {
          return false;
        }
      }
      if (!q) return true;
      const spec = getComponentSpec(item.nodeName);
      const desc = spec?.description.toLowerCase() ?? '';
      return (
        item.plainName.toLowerCase().includes(q) ||
        item.nodeName.toLowerCase().includes(q) ||
        desc.includes(q) ||
        (item.isIllustrativeReconstruction &&
          'illustrative mechanical reconstruction'.includes(q))
      );
    });
  }, [summary.allComponents, activeCategory, searchQuery]);

  const totalSeparatedCount =
    summary.separatedGroups.length + summary.separatedMechanicalGroups.length;

  return (
    <>
      {/* Thin Numbered Chapter Rail (Desktop Left Spine) */}
      <nav
        aria-label="Editorial Disassembly Chapters"
        data-testid="chapter-rail"
        data-active-chapter={summary.chapterNumber}
        className="pointer-events-auto hidden lg:flex flex-col items-start gap-1 absolute left-4 top-1/2 -translate-y-1/2 z-20"
      >
        <div className="relative flex flex-col gap-0.5 py-1 pl-2 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-white/12">
          <div
            aria-hidden="true"
            className="absolute left-0 top-2 w-[1.5px] bg-[#e11d2a] origin-top transition-all duration-150"
            style={{
              height: `calc((100% - 16px) * ${summary.scrollProgress.toFixed(3)})`,
            }}
          />

          {EDITORIAL_CHAPTERS.map((chapter) => {
            const isActive = summary.chapterIndex === chapter.index;
            const isPassed = summary.chapterIndex > chapter.index;
            const isMechanicalChapter = chapter.number === '07';

            return (
              <button
                key={chapter.number}
                type="button"
                data-testid={`chapter-rail-item-${chapter.number}`}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onJumpToProgress(chapter.targetProgress)}
                className={`group flex items-center gap-2 px-1.5 py-0.5 rounded-md text-left cursor-pointer editorial-transition ${
                  isActive
                    ? isMechanicalChapter
                      ? 'bg-[#1a1510]/95 text-amber-100 border border-amber-400/45 shadow-lg'
                      : 'bg-[#12151d]/95 text-white border border-white/14 shadow-lg'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#12151d]/70 border border-transparent'
                }`}
              >
                <span
                  className={`font-mono-tabular text-[10px] font-semibold tracking-wider ${
                    isActive
                      ? isMechanicalChapter
                        ? 'text-amber-300'
                        : 'text-[#ff4d58]'
                      : isPassed
                        ? 'text-zinc-300'
                        : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                >
                  {chapter.number}
                </span>
                <span
                  className={`text-[11px] font-medium tracking-tight whitespace-nowrap ${
                    isActive
                      ? 'text-white'
                      : isMechanicalChapter
                        ? 'text-amber-200/80 group-hover:text-amber-100'
                        : 'text-zinc-400 group-hover:text-zinc-200'
                  }`}
                >
                  {chapter.shortTitle}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Compact Editorial Chapter & Searchable Categorized Parts Inspection Control */}
      <aside
        aria-label="Synchronized Presentation & Mechanical Assemblies"
        data-testid="synchronized-parts-panel"
        data-panel-expanded={String(isExpanded)}
        data-scroll-progress={summary.scrollProgress.toFixed(3)}
        data-chapter-number={summary.chapterNumber}
        data-chapter-title={summary.chapterTitle}
        data-moving-count={summary.movingGroups.length}
        data-moving-group-names={summary.movingGroups
          .map((g) => g.plainName)
          .join(', ')}
        data-separated-count={summary.separatedGroups.length}
        data-separated-mechanical-count={summary.separatedMechanicalGroups.length}
        data-selected-group={selectedGroup ?? ''}
        data-structure-mode={String(structureMode)}
        className="pointer-events-auto absolute top-2 left-2.5 right-2.5 lg:right-auto lg:top-3 lg:left-4 lg:w-[336px] z-20 bg-[#0d1016]/94 border border-white/10 rounded-xl shadow-2xl px-2.5 py-1.5 flex flex-col gap-1 editorial-panel-enter"
      >
        {/* Row 1: Chapter Index, Animated Stage Label, Progress %, Direct Chapter Buttons & Drawer Toggle */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                data-testid="active-chapter-badge"
                className={`font-mono-tabular text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded shrink-0 border ${
                  summary.chapterNumber === '07'
                    ? 'text-amber-300 bg-amber-500/15 border-amber-400/40'
                    : 'text-[#ff5a64] bg-[#e11d2a]/15 border-[#e11d2a]/35'
                }`}
              >
                {summary.chapterNumber}
              </span>
              <h2
                key={summary.stageLabel}
                className="font-display text-xs font-semibold text-white tracking-normal truncate editorial-stage-title"
                data-testid="scroll-stage-label"
              >
                {summary.stageLabel}
              </h2>
              <span
                className="text-[10px] font-mono-tabular text-zinc-300 bg-white/8 px-1.5 py-0.5 rounded shrink-0"
                data-testid="scroll-progress-pct"
              >
                {pct}%
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <div
                className="flex items-center gap-0.5 bg-[#090b0f] border border-white/8 rounded-lg p-0.5"
                role="group"
                aria-label={reducedMotion ? 'Step View' : 'Jump To Stage'}
              >
                <button
                  type="button"
                  data-testid="jump-assembled-btn"
                  onClick={() => onJumpToProgress(0)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition cursor-pointer whitespace-nowrap ${
                    pct <= 2
                      ? 'bg-[#e11d2a] text-white'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  Assembled
                </button>
                <button
                  type="button"
                  data-testid="jump-halfway-btn"
                  onClick={() => onJumpToProgress(0.5)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition cursor-pointer whitespace-nowrap ${
                    pct > 2 && pct < 68
                      ? 'bg-[#e11d2a] text-white'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  Exterior
                </button>
                <button
                  type="button"
                  data-testid="jump-separated-btn"
                  onClick={() => onJumpToProgress(1)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition cursor-pointer whitespace-nowrap ${
                    pct >= 72
                      ? 'bg-amber-500 text-black font-semibold'
                      : 'text-amber-300/90 hover:text-amber-200'
                  }`}
                >
                  Chassis &amp; V12
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? 'Collapse searchable 32 components list'
                    : 'Expand searchable 32 components list'
                }
                data-testid="parts-panel-toggle"
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 hover:text-white bg-[#171b24] hover:bg-[#1f2430] border border-white/10 rounded-lg editorial-transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="font-mono-tabular">
                  {totalSeparatedCount}/30
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                )}
              </button>
            </div>
          </div>

          <div className="w-full h-[2.5px] bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                summary.chapterNumber === '07' ? 'bg-amber-400' : 'bg-[#e11d2a]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Chapter 07 Illustrative Mechanical Reconstruction Notice */}
        {summary.chapterNumber === '07' && !selectedSpec && (
          <div
            data-testid="chapter-07-reconstruction-notice"
            className="flex items-start gap-1.5 px-2 py-1 rounded-lg bg-[#19150e] border border-amber-400/40 text-[10px] text-amber-100/95 leading-snug"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong data-testid="illustrative-reconstruction-badge">
                Illustrative mechanical reconstruction
              </strong>{' '}
              — Procedural mid-rear 65° V12, intake plenums, 12 velocity stacks, Inconel headers,
              transaxle, carbon tub &amp; pushrod suspension (not OEM CAD).
            </span>
          </div>
        )}

        {/* Structure Mode Notice (when active) */}
        {structureMode && (
          <div
            data-testid="structure-mode-notice"
            className="flex items-start gap-1.5 px-2 py-1 rounded-lg bg-[#161922] border border-[#e11d2a]/40 text-[10px] text-zinc-200 leading-snug"
          >
            <EyeOff className="w-3 h-3 text-[#ff4d58] shrink-0 mt-0.5" />
            <span>
              <strong>Structure Mode:</strong> Outer bodywork &amp; glazing hidden to reveal{' '}
              <strong>Cabin</strong>, <strong>Underbody</strong> &amp;{' '}
              <strong>Illustrative mechanical reconstruction</strong>.
            </span>
          </div>
        )}

        {/* Selected Component Close-Up Inspection Card + Back to Car */}
        {selectedSpec && (
          <div
            data-testid="selected-group-explanation"
            data-explained-group={selectedSpec.nodeName}
            data-is-illustrative={String(selectedIsMechanical)}
            className={`px-2.5 py-1.5 rounded-lg text-xs space-y-1 border ${
              selectedIsMechanical
                ? 'bg-[#191510] border-amber-400/60'
                : 'bg-[#1a1418] border-[#e11d2a]/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Info
                  className={`w-3.5 h-3.5 shrink-0 ${
                    selectedIsMechanical ? 'text-amber-400' : 'text-[#ff4d58]'
                  }`}
                />
                <span className="font-display font-semibold text-white truncate">
                  {selectedSpec.plainName}
                </span>
                <span className="text-[10px] font-mono-tabular text-zinc-300 bg-black/40 px-1.5 py-0.5 rounded shrink-0">
                  {selectedProgressItem?.state === 'fixed'
                    ? 'Fixed Core'
                    : selectedProgressItem?.state === 'moving'
                      ? 'Moving'
                      : selectedProgressItem?.state === 'separated'
                        ? 'Separated'
                        : 'Inspecting'}
                </span>
              </div>
              <button
                type="button"
                onClick={onBackToCar}
                aria-label="Back to car"
                data-testid="back-to-car-btn"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-white bg-[#e11d2a] hover:bg-[#c81924] rounded cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to car</span>
              </button>
            </div>
            {selectedIsMechanical && (
              <div className="flex items-center gap-1.5">
                <span
                  data-testid="illustrative-reconstruction-badge"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-medium text-amber-300 bg-amber-500/15 border border-amber-400/35"
                >
                  Illustrative mechanical reconstruction · Not OEM CAD
                </span>
              </div>
            )}
            <p className="text-[11px] text-zinc-300 leading-snug">
              {selectedSpec.description}
            </p>
          </div>
        )}

        {/* Row 2: Active Moving-Part Chips (Click to Inspect Part in Close-Up) */}
        <div className="pt-0.5 border-t border-white/8 flex flex-col gap-1">
          {summary.movingGroups.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
                <span className="uppercase tracking-wider font-medium">
                  Active Stage Assemblies
                </span>
                <span className="font-mono-tabular">
                  {summary.movingGroups.length} moving · click to inspect
                </span>
              </div>
              <ul
                aria-label="Groups Currently Moving"
                data-testid="moving-groups-list"
                className="flex flex-wrap gap-1 text-[10px] text-white font-medium max-h-16 overflow-y-auto"
              >
                {summary.movingGroups.map((g) => {
                  const isSelected = selectedGroup === g.nodeName;
                  const isHidden = structureMode && g.hiddenInStructureMode;
                  return (
                    <li key={g.nodeName} data-group-node={g.nodeName}>
                      <button
                        type="button"
                        onClick={() =>
                          isSelected ? onBackToCar() : onSelectGroup(g.nodeName)
                        }
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 whitespace-nowrap cursor-pointer editorial-transition border ${
                          isSelected
                            ? 'bg-[#e11d2a] text-white border-white/40'
                            : isHidden
                              ? 'bg-[#151820] text-zinc-500 border-white/10 line-through'
                              : g.isIllustrativeReconstruction
                                ? 'bg-[#1d1810] text-amber-100 border-amber-400/45 hover:bg-[#282115]'
                                : 'bg-[#181c26] text-white border-[#e11d2a]/45 hover:bg-[#232836]'
                        }`}
                      >
                        <span>{g.plainName}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p
              className="text-[10px] text-zinc-400 leading-snug"
              data-testid="moving-groups-empty"
            >
              {summary.scrollProgress <= 0.01
                ? 'Scroll through 7 chapters (including Chassis & V12), or click any label to inspect.'
                : summary.scrollProgress < 0.08
                  ? 'Settling into three-quarter stance before wheel & caliper separation.'
                  : summary.scrollProgress >= 0.98
                    ? 'Exterior & illustrative mid-rear V12/chassis fully separated around Carbon Tub.'
                    : 'Exterior assemblies separated; scroll further for Chapter 07 Chassis & Powertrain.'}
            </p>
          )}
        </div>

        {/* Row 3: Collapsible Searchable & Categorized 32-Component List */}
        {isExpanded && (
          <div
            className="space-y-1.5 pt-1 border-t border-white/8"
            data-testid="all-groups-section"
          >
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-zinc-400 absolute left-2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 32 parts (V12, intake, tub, door...)"
                aria-label="Search modeled components"
                data-testid="parts-search-input"
                className="w-full pl-6 pr-6 py-1 text-[11px] text-white placeholder-zinc-500 bg-[#080a0e] border border-white/12 rounded-lg focus:outline-none focus:border-[#e11d2a]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  data-testid="parts-search-clear-btn"
                  className="absolute right-1.5 p-0.5 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div
              role="group"
              aria-label="Component Category Filter"
              data-testid="parts-category-filter"
              className="flex flex-wrap gap-1"
            >
              {CATEGORY_FILTERS.map((cat) => {
                const active = activeCategory === cat.id;
                const isMechCat =
                  cat.id === 'v12_powertrain' || cat.id === 'chassis_suspension';
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`parts-category-${cat.id}`}
                    aria-pressed={active}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded cursor-pointer editorial-transition border ${
                      active
                        ? isMechCat
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                          : 'bg-[#e11d2a] text-white border-white/30'
                        : 'bg-[#12151d] text-zinc-400 border-white/8 hover:text-zinc-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
              <span className="uppercase tracking-wider font-medium whitespace-nowrap">
                {filteredComponents.length} Components Shown
              </span>
              <span className="font-mono-tabular whitespace-nowrap text-amber-300/90">
                19 GLB · 13 Illustrative V12/Chassis
              </span>
            </div>

            <ul
              aria-label="All Modeled Components"
              data-testid="all-groups-list"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-0.5 text-[11px] max-h-44 lg:max-h-52 overflow-y-auto pr-0.5"
            >
              {filteredComponents.map((g) => {
                const isSelected = selectedGroup === g.nodeName;
                const isHidden = structureMode && g.hiddenInStructureMode;
                let textClass = 'text-zinc-300 hover:text-white';
                let statusTag = '';
                if (isHidden) {
                  textClass = 'text-zinc-500 line-through hover:text-zinc-300';
                  statusTag = 'Hidden';
                } else if (g.state === 'fixed') {
                  textClass = 'text-zinc-200 font-medium hover:text-white';
                  statusTag = 'Fixed';
                } else if (g.state === 'moving') {
                  textClass = 'text-white font-semibold';
                  statusTag = 'Moving';
                } else if (g.state === 'separated') {
                  textClass = 'text-zinc-200 hover:text-white';
                  statusTag = 'Out';
                }

                return (
                  <li
                    key={g.nodeName}
                    data-group-state={g.state}
                    data-illustrative={String(g.isIllustrativeReconstruction)}
                  >
                    <button
                      type="button"
                      data-testid={`group-list-item-${g.nodeName}`}
                      onClick={() =>
                        isSelected ? onBackToCar() : onSelectGroup(g.nodeName)
                      }
                      className={`w-full flex items-center justify-between gap-1.5 px-1.5 py-1 rounded text-left cursor-pointer editorial-transition ${
                        isSelected
                          ? 'bg-[#e11d2a]/25 border border-[#e11d2a] text-white font-semibold'
                          : `${textClass} hover:bg-white/5 border border-transparent`
                      }`}
                    >
                      <span className="truncate">{g.plainName}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {g.isIllustrativeReconstruction && (
                          <span className="text-[9px] font-mono-tabular text-amber-300 bg-amber-500/15 border border-amber-400/30 px-1 rounded">
                            Illustrative
                          </span>
                        )}
                        {statusTag && (
                          <span className="text-[9px] font-mono-tabular text-zinc-400">
                            {statusTag}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filteredComponents.length === 0 && (
                <li
                  data-testid="parts-search-empty"
                  className="col-span-full py-3 text-center text-[11px] text-zinc-400"
                >
                  No components match &ldquo;{searchQuery}&rdquo;.
                </li>
              )}
            </ul>
          </div>
        )}
      </aside>
    </>
  );
};
