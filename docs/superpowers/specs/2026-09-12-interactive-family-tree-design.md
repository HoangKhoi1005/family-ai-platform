# Interactive Family Tree Design

**Date:** 2026-09-12
**Status:** Implemented and verified on the feature branch
**Context:** Family AI context 1.4.0, mobile-primary pilot for 15 people

## Goal

Replace the connected tree's horizontally scrolling generation rows with a direct-manipulation canvas that feels natural on a phone while preserving the approved relationship graph, profile sheet, proposal flow, directory fallback, and Vietnamese album-like visual language.

## Decision

Use `@xyflow/react` 12.11.x as the viewport and interaction layer. Keep the existing deterministic generation model for initial positions in this slice; do not add Dagre or ELK yet.

React Flow supplies pointer panning, pinch and wheel zoom, programmatic viewport controls, draggable HTML nodes, and keyboard/screen-reader primitives. Its custom React nodes allow the current family identity design to remain product-specific. Cytoscape.js is optimized for graph analysis and owns an empty visualization container; HTML nodes and comparable accessible interactions require extensions or an extra DOM layer. A custom D3 renderer would keep the dependency small but would make the team own gesture arbitration, focus, keyboard behavior, click-versus-drag handling, and viewport controls.

Primary references: [React Flow interaction API](https://reactflow.dev/api-reference/react-flow), [custom nodes](https://reactflow.dev/learn/customization/custom-nodes), [accessibility](https://reactflow.dev/learn/advanced-use/accessibility), and [layout options](https://reactflow.dev/learn/layouting/layouting).

The current pilot graph is small and already has stable generation rows. Adding an automatic layout engine now would increase bundle and behavior complexity before spouse grouping and larger-family layout requirements are proven. The renderer receives a focused layout interface so a later Dagre or ELK adapter can replace the positioning algorithm without changing API contracts or relationship truth.

## Interaction design

- The canvas occupies most of the available mobile viewport without covering the bottom navigation.
- Dragging the background pans. Pinching zooms on touch devices; the wheel zooms on desktop.
- A compact Vietnamese toolbar provides **Thu nhỏ**, **Phóng to**, **Vừa cây**, and **Về tôi**. It uses existing tokens and no generic diagram-editor chrome.
- A member card opens the existing profile sheet. A short, separate grip area moves the card inside the current session; movement never updates a Member or Relationship.
- A node with farther graph neighbors offers **Thu nhánh** or **Mở nhánh**. Branch visibility is derived from distance away from the current root, not from guessed Vietnamese kinship.
- `Về tôi` centers the root member and restores a readable zoom. `Vừa cây` fits all currently visible nodes.
- The approved-edge ledger remains below the canvas as an equivalent textual account of every relationship.
- The directory remains fully usable for people who cannot or do not want to manipulate the canvas.

## Data boundaries

`RelationshipGraphResponse` remains the only graph input. A pure layout module converts approved nodes and edges into renderer-neutral node positions, visible IDs, branch affordances, and edge seeds. It never creates, updates, removes, or infers relationships.

Collapsed branches and dragged coordinates are local UI state. They reset when the graph scope changes or the page reloads. No migration, API route, permission rule, or server contract changes in D1.

## Accessibility

- Profile and branch actions are native buttons with Vietnamese accessible names and 44×44 CSS pixel minimum targets.
- The canvas has a concise interaction description and a live status for branch changes.
- The node drag grip is supplementary. Every profile remains reachable through the directory and every relationship remains readable in the ledger.
- Reduced motion disables animated viewport transitions.
- Focus remains visible, and opening/closing the profile sheet keeps the existing focus restoration behavior.

## Error and empty states

Existing unlinked-profile, loading, graph-error, one-person-tree, and empty-relationship states remain outside the renderer. A renderer failure must stay local to the Gia phả destination and must not remove the directory.

## Verification

- Unit tests cover deterministic positions, approved-edge mapping, root-relative collapse, and immutable source data.
- Browser tests cover pan/zoom controls, `Về tôi`, branch collapse/expand, node drag without profile opening, profile opening, directory fallback, and no horizontal page overflow.
- Run the existing connected mobile tests at 390×844 and add a 320px viewport check. Preserve the current 768px and 1280px coverage.
- Run `npm run check` with `API_INTERNAL_URL=http://127.0.0.1:4010`, then the targeted Playwright suite.

## Deferred

- Persisting node positions or viewport state.
- A new automatic layout engine, spouse-family grouping rules, and unbounded graph loading.
- Update/remove/cancel relationship UI and adding a brand-new Member from a node.
- Calendar, notifications, moments, chat, AI, and production deployment.
