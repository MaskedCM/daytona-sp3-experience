# From a rotating car to an explorable machine

The project began with a simple interaction: show a complete Daytona SP3 turning in a studio, then let scrolling separate its parts and reveal what lies beneath. The aim was a focused experience for one car, rather than a generic model-import tool.

## Starting with usable geometry

A downloadable SP3 model supplied the exterior geometry and textures. Preparing that model for the web meant identifying useful connected pieces, regrouping them into 19 presentation assemblies and producing a smaller Meshopt-compressed asset. A technical-reference pack helped guide proportions and the general placement of mechanical elements.

The source model was not a complete engineering assembly. Rather than imply hidden factory detail was present, the deeper chassis and engine layer was built as an explicitly illustrative reconstruction. This allowed the experience to explain a mid-rear V12 layout while keeping the distinction between sourced geometry and procedural additions visible.

## Making disassembly useful

Explosion spacing alone was not enough. Inspection needed readable labels, a searchable catalogue, component explanations and a way to focus on one assembly. Hide/isolate controls, related-part links and a parts tray turned separation into something a visitor could explore rather than a single animation to watch.

The final catalogue contains 32 entries across bodywork, wheels/brakes, chassis and powertrain. Camera fitting and label density help adapt that content to different viewport sizes.

## Getting the moving parts to belong together

Door motion exposed a different problem: moving the outer skin without the inner structure makes a car appear broken. The door bindings were refined so skins, cards, glazing and attached details move together, while seats, tub and sills remain fixed. Those hinge transforms also need to work while the car is exploded.

Six wheel options, material-specific finish controls, opening panels and spatial lights added ways to compare and customise the assembled car without losing the inspection features.

## Going inside the engine

The Engine Lab adds a separate view of a working V12 mechanism. Pistons, rods and the crankshaft move according to slider-crank geometry; the four-stroke cycle is presented through animation and inspection controls. Tests check the relationships between those parts rather than just checking that a scene exists.

This is an explanatory mechanism, not a claim to reproduce every detail of Ferrari's engine.

## Sound that behaves like a control

The sound design evolved from short effects to an engine that remains active until the visitor stops it. The selected reference is gameplay footage of the SP3. Startup transitions into a loudness-matched running sustain; Rev holds a steadier high-RPM passage instead of replaying rising-and-falling throttle blips.

The repeating sustains use prepared lossless PCM buffers and native Web Audio looping. Explicit opt-in, smooth switching, Stop, mute and hidden-tab cancellation are part of the experience, rather than incidental audio-player behaviour. Source and licence limitations remain documented.

## Publishing the finished experience

Development used Google AI Studio, Gemini 4 Argon Max and Codex, with iterative visual review and targeted tests. The release separates development tools from runtime: visitors receive a static browser application, with the model, lighting, fonts and sound packaged alongside it.

GitHub holds the source and detailed documentation. GitHub Actions verifies changes and GitHub Pages serves the production build. This makes the project portable and independent of the original development laptop or an AI Studio preview session, while keeping the practical limits of any long-term hosting promise explicit.
