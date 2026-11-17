# Asset sources, changes and reuse status

This repository contains media under different terms. Public availability and attribution do not create a blanket reuse licence. The project has no project-wide open-source licence; each third-party item retains its own terms. Ferrari names, emblems and designs remain the property of their respective owners. This is an independent educational fan project, not an official Ferrari product.

## 3D car model — recorded CC BY 4.0

- Title: **Ferrari Daytona SP3 2022 | www.vecarz.com**
- Creator: **vecarz** ([Sketchfab profile](https://sketchfab.com/heynic))
- [Original model page](https://sketchfab.com/3d-models/ferrari-daytona-sp3-2022-wwwvecarzcom-ce0844ab396143f69628188fc39fa8bf)
- Licence recorded from the download page during preparation: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Included file: `public/models/daytona-sp3-web.glb`
- Changes: regrouped connected geometry into 19 presentation assemblies, retained original triangle geometry, applied Meshopt compression and geometry quantization for web delivery. Application code additionally adds illustrative mechanical geometry, procedural wheel alternatives, hinge bindings and material changes.

Keep creator attribution, the source link, licence link and modification notice with redistributed derivatives. The asset's recorded licence does not grant rights to Ferrari trademarks or unrelated media.

## Lighting environment — CC0

- Title: **Studio Small 09**
- Source: **Poly Haven**, Greg Zaal / Rico Cilliers
- [Asset page](https://polyhaven.com/a/studio_small_09)
- [Poly Haven licence](https://polyhaven.com/license)
- Included file: `public/environments/studio-small-09-2k.hdr`
- Status: **CC0 1.0**, used as studio image-based lighting.

## Engine audio — reuse licence not verified

- Video: **PURE V12 SOUND | Ferrari Daytona SP3 (Assetto Corsa EVO 0.4)**
- Video creator: **DARK WORKS**
- [Source video](https://www.youtube.com/watch?v=DbwVURaXI-Y)
- Content: **Assetto Corsa EVO gameplay audio**, not a real-car microphone recording.
- Embedded in `src/audio/freeSoundPack.ts`; the filename does not establish a licence.
- Startup excerpt: **9.25–11.30 s**.
- Running sustain source: **11.05–12.15 s**.
- High-RPM sustain source: **114.92–115.651 s**.
- Changes: trimming, filtering, phase-aligned overlap preparation, loudness matching around -18 LUFS and encoding. Startup is MP3; repeating sustains use 48 kHz stereo PCM WAV buffers for exact loop boundaries.

**No Creative Commons or royalty-free licence was verified for these video excerpts. Attribution is not permission.** This repository does not grant reuse rights to the video creator's recording or the underlying game audio. Obtain appropriate permission or replace the engine clips with audio whose licence covers the intended distribution, especially before commercial reuse. Gameplay/source attribution is displayed in the app as well.

## Generic panel foley — CC0

- Recording: **CAR DOOR OPEN CLOSE.wav**
- Creator: **kennydoug**
- [Source](https://freesound.org/people/kennydoug/sounds/485993/)
- Licence: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Changes: trimmed and processed public HQ preview; subtle panel open/close and relay effects.
- This is generic 2012 Chevrolet Impala foley, not a recording of the SP3.

## Ferrari technical reference image

- Included file: `public/assets/aistudio/daytona-sp3-preview_bcec83a0.jpg`
- Origin: compiled Ferrari Daytona SP3 product-information/reference imagery used during development.
- [Ferrari product-information source](https://www.ferrari.com/content/dam/ferrari-fcom/old/pdf/cs_ferrari_daytona_sp3_gbr.pdf)
- Status: Ferrari/third-party reference imagery. No separate CC or royalty-free redistribution licence has been verified. This image is not covered by the car model's licence.

## Fonts and software

- **Outfit**, **Plus Jakarta Sans**, **JetBrains Mono**: self-hosted from Fontsource variable-font packages; individual SIL Open Font License notices are retained in `docs/third-party/`.
- **Three.js**, **React**, **Vite**, **GSAP**, **Lucide**, **Tailwind CSS** and build dependencies: retain their own package licences. Refer to each installed package and `package-lock.json`; no blanket licence for dependencies is substituted here.

## Procedural geometry and project code

The additional chassis/engine geometry, alternate wheels, animation logic and interface code form the project's implementation. No project-wide open-source licence has been selected for that code. Being in a public repository is not a general grant to reuse everything under an assumed MIT or other licence.

The illustrative engine and chassis are not OEM engineering data, and the app should not be used as a repair or manufacturing reference.
