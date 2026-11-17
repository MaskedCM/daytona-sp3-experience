# Architecture

## One client application

React and TypeScript own the user interface and experience state. Three.js owns the WebGL scenes, materials, lighting, camera controls and image capture. GSAP ScrollTrigger maps page scroll to a normalised disassembly progress value. There is no application backend, authentication system or AI inference at runtime.

`App.tsx` coordinates Showroom, Anatomy, Customise, Photo Mode, cockpit view and the Engine Lab. Camera, paint, wheel design, open panels and visibility settings are explicit state. Scene objects are kept behind component refs so changing the UI does not require rebuilding the entire model.

## Model preparation and assembly identity

The imported model is a visual SP3 asset from vecarz. The web version contains 19 presentation groups. Existing triangles were regrouped into useful exterior assemblies, then encoded with Meshopt and geometry quantization. Meshopt decoding is bundled through the Three.js addon; the shipped model does not need an external Draco decoder service.

The procedural mechanical layer adds 13 named groups for chassis and powertrain exploration. Together these form the 32-entry inspection catalogue. The catalogue connects names, categories, explanations and related components to scene bindings.

These are presentation assemblies, not a factory bill of materials. The mechanical layer is an educational reconstruction and is labelled accordingly.

## Reversible disassembly

Each bound group retains its original transform. Disassembly computes an offset from that base pose for the current timeline progress and spread value. Returning to zero restores the assembled pose instead of accumulating transform deltas.

The exterior sequence separates wheels, brakes, bodywork, cabin, glazing and mirrors. The later chapter exposes and separates the illustrative chassis/V12 layer. Camera fitting considers visible geometry so the expanded view can remain in frame. Labels are projected to the screen, prioritised and capped according to density and viewport size.

Parts tray, hide and isolate use the same assembly identities. Tray restoration is tested against actual GLB transforms so switching between inspection modes does not permanently displace the car.

## Hinges and lights

Door skins, glazing, handles and inner door cards are bound into coordinated butterfly-door motion. Cabin seats, the tub and sills remain fixed. Front and rear covers have separate hinge transforms. Hinge motion composes with explosion offsets, rather than replacing them.

Front/rear light controls update bound lamp materials and spatial light nodes. Panel and light controls also trigger restrained sound effects when sound is enabled.

## Materials and wheels

Finish controls target specific paint, caliper, leather and hardtop materials. The imported rim remains the factory option. Five procedural wheel designs are fitted to wheel-local geometry, preserving tyre and brake positioning. The chosen wheel identifier is stored locally in the browser; this is a preference, not server-side user data.

The lighting environment is a bundled HDRI. Materials use the scene's environment and studio lights. Procedural engine geometry and the Engine Lab remain illustrative rather than photogrammetry or a detailed reproduction of the F140HC.

## Engine mechanism

`engineMechanism.ts` solves piston and connecting-rod positions using slider-crank geometry. Tests sample two crankshaft revolutions and verify rod length and piston-axis constraints. Twelve pistons and rods are animated, with the four-stroke phases presented for inspection. Engine selection and playback controls are separate from the car's scroll-disassembly state.

## Audio lifecycle

The Web Audio context and embedded pack are created/loaded only after explicit sound opt-in. Startup is a one-shot source. Running and Rev are native looping buffer sources with a prepared PCM running sustain and a longer original recorded rev passage, rather than repeating JavaScript timers that fade each clip to silence.

All engine modes use matched playback gain; the edited source assets were loudness matched around -18 LUFS. Start from Rev crossfades directly into the running loop without replaying the starter. Rev remains active until an explicit switch, Stop, mute or hidden-tab stop.

Rev uses a 7.14-second stationary passage from the original recording, retaining its rises/falls and natural amplitude changes. Only a constant gain and 30 ms repeat-boundary overlap are applied. Pitch shifting, time stretching, EQ and rapid gain correction are absent from that asset. The owner chose repeating natural revs rather than a frozen high note.

The controller owns voices, pending transition timers, fade cleanup timers, filters and the context. Cancellation tokens prevent a pending startup callback from resurrecting playback after Stop. Mute stops playback; unmute remains quiet. Context disposal releases nodes and timers. Cockpit and rear-cover state change the sound's filtering/presence.

Tests use a time-aware fake AudioParam model so a ramp is evaluated over time instead of being mistaken for an immediate assignment. They check sustained playback beyond 60 seconds, bounded active loops and cancellation paths. Actual device audio, speaker quality and subjective loop quality still require listening tests.

## Static hosting and paths

Vite builds the app into `dist/`. `publicAssetUrl()` combines Vite's base URL with model, environment and image paths. The GitHub Actions workflow supplies `/<repository-name>/`; local development defaults to `/`. This keeps resources on the same host and avoids broken root-relative asset requests on a project Pages site.

Fonts are imported from local Fontsource packages and emitted into the build. Runtime does not depend on Google Fonts, an AI Studio preview URL, Gemini credits, API credentials or an application server. Attribution links remain external links that the visitor may choose to open.

## Verification boundaries

Automated tests cover scene structure, transforms, framing, finish targeting, engine constraints and audio state/lifecycle. The artifact verifier checks deployment paths, required files and binary signatures. Browser verification checks actual rendering and interactions.

A passing suite does not certify a mechanically accurate SP3, guarantee a frame rate on every GPU, prove browser compatibility on every phone, clear third-party media rights, or guarantee indefinite hosting. Those limits are documented separately from the implementation.
