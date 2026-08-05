# Last Survivor

Last Survivor is being rebuilt as a large-scale, open-world cooperative survival game. The repository currently contains the preserved playable prototype and the new V2 foundation.

## V1 Prototype

The root `index.html`, `game.js`, `styles.css`, `sprites/`, and `music/` files are the existing static browser prototype. Open `index.html` directly or use the published GitHub Pages build.

### V1 Controls

- `W`, `A`, `S`, `D`: move
- Mouse: aim
- Left click: shoot
- `R`: reload
- `E`: interact, loot, or harvest
- `F`: toggle flashlight
- `Shift`: sprint
- `Ctrl`: crouch
- `Space`: jump
- `I`: inventory
- `1`, `2`, `3`: switch weapons
- `B`: collapse or expand the tech tree
- `M`: admin time controls
- `Esc` or `P`: pause

## V2 Rework

V2 is isolated under `apps/` and `packages/`. It uses Phaser 3, TypeScript, Vite, and an authoritative Colyseus server.

### Requirements

- Node.js 22 or newer
- npm 10 or newer

### Run Locally

```powershell
npm install
npm run dev
```

Open:

- Client: `http://127.0.0.1:5173`
- Server health: `http://127.0.0.1:2567/health`

Each browser profile receives one persistent survivor identity. Use a second browser or a private/incognito profile to test multiple players; opening another tab in the same profile is rejected as a duplicate survivor connection.

### V2 Controls

- `W`, `A`, `S`, `D`: move
- Mouse: aim
- Left click: fire the development pistol
- `E`: enter, leave, search, or cancel a search
- `I`: open or close the 4x4 inventory

V2 combat is server-authoritative. Shared zombies track health, aggro, player damage contributions, respawn timers, and highest-contribution loot ownership. The starting camp is protected from zombie targeting.

Buildings use reusable prefab definitions with instance-specific exterior positions, interior spaces, collision, and searchable container IDs. House 48 and House 73 currently share the first summer-house prefab while retaining independent multiplayer presence, loot state, and persistence.

Inventory mutations are server-authoritative. Stacks can be moved, split, dropped into the shared world, and collected once by any connected player. Temporary art is centralized under `sprites/Sprites-Loaded`; replacing an image at the same path updates V2 without changing gameplay code.

Append `?world=world-name` to the client URL to create or join an isolated development world.

### Development Persistence

The V2 server checkpoints survivor positions, slot inventories, shared world pickups, container state, and zombies every five seconds and when players disconnect. Local save data is written to `apps/server/data/worlds.json` and is excluded from Git.

Set `LAST_SURVIVOR_DATA_FILE` to use a different data path. Delete the local file while the server is stopped to reset the development world. Storage is accessed through a repository interface so the file adapter can be replaced by PostgreSQL for production deployment.

### Validation

```powershell
npm run check
```

This runs strict TypeScript checks, server persistence, world-generation and simulation tests, and production builds for both applications.

## Architecture

The technical direction, BiomeGen model, persistence strategy, delivery phases, and first vertical-slice definition are documented in [docs/V2_ARCHITECTURE.md](docs/V2_ARCHITECTURE.md). The practical content-reuse and sprite-replacement contract is documented in [docs/V2_CONTENT_AND_BIOMEGEN.md](docs/V2_CONTENT_AND_BIOMEGEN.md).

The existing prototype is marked by the `prototype-v1` Git tag. Active V2 work begins on the `rework/v2` branch.
