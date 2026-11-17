import {publicAssetUrl} from '../utils/publicAssets';
import React from 'react';
import { X, FileImage, ExternalLink, Volume2 } from 'lucide-react';
import { HDRI_CREDIT, MODEL_CREDIT } from '../types/studio';
import { ILLUSTRATIVE_SOUND_CREDITS } from '../audio/soundEngine';

export interface ReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

export const ReferenceModal: React.FC<ReferenceModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-sheet-title"
      data-testid="reference-credits-modal"
    >
      <div className="relative w-full max-w-5xl bg-[#18191e] border border-white/12 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <FileImage className="w-4 h-4 text-[#e11d2a]" />
            <h2
              id="ref-sheet-title"
              className="font-display text-base font-semibold text-white tracking-tight"
            >
              Ferrari Daytona SP3 — Architecture Reference &amp; Credits
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-reference-modal-btn"
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#252830] hover:bg-[#303440] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            aria-label="Close Reference Sheet"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <p className="text-xs text-zinc-400 leading-relaxed">Independent educational fan project. Not affiliated with or endorsed by Ferrari. Ferrari names, emblems and vehicle designs belong to their respective owners.</p>
          {/* Model & Environment Credits Section */}
          <section
            aria-labelledby="model-credit-heading"
            className="space-y-3 pb-5 border-b border-white/10"
          >
            <h3
              id="model-credit-heading"
              className="font-display text-sm font-semibold text-white tracking-tight"
            >
              3D Model, Illustrative Mechanical Layer &amp; Studio HDRI Attribution
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              3D model:{' '}
              <a
                href={MODEL_CREDIT.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/40 hover:decoration-white inline-flex items-center gap-1"
              >
                <span>&ldquo;{MODEL_CREDIT.title}&rdquo;</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              by{' '}
              <a
                href={MODEL_CREDIT.creatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/40 hover:decoration-white inline-flex items-center gap-1"
              >
                <span>{MODEL_CREDIT.creator}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              , via Sketchfab, licensed under{' '}
              <a
                href={MODEL_CREDIT.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/40 hover:decoration-white inline-flex items-center gap-1"
              >
                <span>{MODEL_CREDIT.licenseLabel}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              .
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <code className="text-zinc-200">daytona-sp3.glb</code> was extracted from the
              creator&apos;s original-format download without modification.{' '}
              <code className="text-zinc-200">daytona-sp3-explodable.glb</code> regroups
              connected pieces into 19 presentation assemblies while retaining the original
              triangle geometry. <code className="text-zinc-200">daytona-sp3-web.glb</code>{' '}
              additionally uses meshopt compression and geometry quantization for web
              delivery. These presentation assemblies are not verified engineering
              assemblies.
            </p>
            <p
              className="text-xs text-amber-200/90 leading-relaxed"
              data-testid="illustrative-mechanical-credit-note"
            >
              <strong>Illustrative mechanical reconstruction:</strong> The internal mid-rear
              65° V12 powertrain (engine block, twin red cam covers, 12 velocity-stack intake
              runners, twin carbon plenums, 6-into-1 Inconel exhaust headers, dry sump, and
              7-speed transaxle gearbox/differential) and chassis assemblies (carbon monocoque
              tub, tubular subframes, double-wishbone arms, and inboard pushrod dampers) are
              procedural Three.js geometric reconstructions calibrated to the Daytona SP3
              orthographic proportions (4,686 mm length, 2,050 mm width, 1,142 mm height,
              2,651 mm wheelbase), not OEM CAD.
            </p>
            <p
              className="text-xs text-zinc-300 leading-relaxed pt-1"
              data-testid="hdri-credit-line"
            >
              Environment reflections:{' '}
              <a
                href={HDRI_CREDIT.assetUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="hdri-credit-link"
                className="text-white underline decoration-white/40 hover:decoration-white inline-flex items-center gap-1"
              >
                <span>{HDRI_CREDIT.title}</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              (<code className="text-zinc-200">{HDRI_CREDIT.assetUrl}</code>) from{' '}
              <span className="text-white">{HDRI_CREDIT.creator}</span>, licensed under{' '}
              <a
                href={HDRI_CREDIT.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/40 hover:decoration-white inline-flex items-center gap-1"
              >
                <span>{HDRI_CREDIT.licenseLabel}</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and loaded locally from{' '}
              <code className="text-zinc-200">{HDRI_CREDIT.localPath}</code> via Three.js{' '}
              <code className="text-zinc-200">HDRLoader</code> &amp;{' '}
              <code className="text-zinc-200">PMREMGenerator</code>.
            </p>
          </section>

          {/* Illustrative Sound & Foley Credits Section */}
          <section
            aria-labelledby="sound-credit-heading"
            className="space-y-3 pb-5 border-b border-white/10"
            data-testid="sound-credits-section"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#e11d2a]" />
              <h3
                id="sound-credit-heading"
                className="font-display text-sm font-semibold text-white tracking-tight"
              >
                Illustrative Recorded Sound &amp; Panel Foley Attribution
              </h3>
            </div>
            <p
              className="text-xs text-amber-200/90 leading-relaxed"
              data-testid="illustrative-sound-disclaimer"
            >
              <strong>Illustrative sound layer (not authentic Daytona SP3 audio):</strong>{' '}
              Engine start (9.25–11.30 s), continuous running idle loop (11.05–12.15 s) and
              steady high-RPM rev loop (114.92–115.651 s, normalised to -18 LUFS) are edited
              excerpts from DARK WORKS’ user-selected Daytona SP3 gameplay video in Assetto
              Corsa EVO. This is game audio; a reuse licence has not been verified. Panel
              opening/closing foley uses generic passenger-car door recordings. All clips are
              opt-in and embedded locally.
            </p>
            <ul className="space-y-2.5 text-xs text-zinc-300" data-testid="sound-credits-list">
              {ILLUSTRATIVE_SOUND_CREDITS.map((item) => (
                <li
                  key={item.url}
                  className="p-3 rounded-lg bg-[#12141a] border border-white/8 space-y-1"
                  data-testid="sound-credit-item"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white underline decoration-white/40 hover:decoration-white inline-flex items-center gap-1"
                    >
                      <span>&ldquo;{item.title}&rdquo;</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-zinc-400">by</span>
                    <span className="text-zinc-200 font-medium">{item.author}</span>
                    <span className="text-zinc-500">·</span>
                    <a
                      href={item.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 underline decoration-amber-300/40 hover:decoration-amber-300 inline-flex items-center gap-1"
                    >
                      <span>{item.license}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    <span className="text-zinc-300 font-medium">Edits &amp; notes:</span>{' '}
                    {item.changes}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-3">
            <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
              Technical reference sheet for the Ferrari Daytona SP3 Icona Series: Exterior
              aerodynamics, T800/T1000 carbon-fibre composite monocoque cutaway, 6.5L
              naturally aspirated F140HC V12 powertrain (840 cv at 9,250 rpm), and exploded
              bodywork/bumper sub-assemblies.
            </p>

            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#111215]">
              <img
                src={publicAssetUrl('assets/aistudio/daytona-sp3-preview_bcec83a0.jpg')}
                alt="Ferrari Daytona SP3 Exterior, Chassis cutaway, V12 engine, and Exploded bodywork diagrams"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain block"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
