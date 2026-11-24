# Editor UI dependencies

The Phase 4 primitives and Phase 7 toolbar use the existing React and React DOM packages, native dialog elements, and ResizeObserver. They introduce no additional runtime package or font download. Toolbar pictograms are original SVG paths in `src/ui/components/AppIcon.tsx`. The interaction fixture is served by Vite at `/src/test/fixtures/primitives/` in development.
