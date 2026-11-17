# Changelog

## 1.0.1 — 2026-11-17

### Corrected Rev tone

- Replaced the processed 0.63-second driving sustain with a 7.14-second passage of the original stationary revs from the selected video.
- Preserved the recorded rises/falls, stereo waveform and original speed. Removed the Rev asset's equalisation and rapid automatic gain correction; only constant gain and a 30 ms repeat-boundary overlap remain.
- Rev repeats those natural recorded revs until Stop, following the owner's updated preference. It no longer attempts to freeze a steady high-RPM note.
- Kept startup, continuous running, smooth switching, volume/mute and cancellation behaviour unchanged.
- Updated interface wording, source timestamps and documentation. Added a regression check to prevent replacing the recorded passage with a sub-second frozen loop again.

Direct audio listening was unavailable in the agent session. Source identity, waveform preservation, encoded asset integrity, playback controls and deployment were checked; subjective tone remains available for the owner to audition.

## 1.0.0 — 2026-11-17

Initial public release: interactive showroom, exploded assemblies, custom finishes and six wheel designs, illustrative V12 lab, Photo Mode, sound controls, GitHub Actions deployment and detailed project documentation.
