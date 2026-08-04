# Last Survivor V2 Architecture

## Product Direction

Last Survivor V2 is a persistent, top-down survival game built around exploration, scavenging, customizable bases, NPC encounters, and private cooperative multiplayer. The initial multiplayer target is one to four players sharing a world and base. PvP and MMO-scale public worlds are not part of the first release.

The existing browser prototype is preserved as V1. V2 is a ground-up implementation rather than an incremental expansion of the single-file prototype.

## Core Principles

1. The server owns truth. Movement, combat, loot, building, NPCs, and persistence are validated by the server.
2. The world is deterministic. A world seed and generator version recreate unchanged terrain anywhere.
3. Persistence stores change, not the whole world. Only player-built structures, depleted resources, opened containers, NPC state, and other differences from generated content are saved.
4. Content is data-driven. Items, recipes, biomes, landmarks, buildings, NPC archetypes, and missions are definitions rather than hard-coded conditionals.
5. Chunks stream independently. Rendering, simulation, networking, and persistence operate on a bounded active set around players.
6. Interiors are separate spaces. Entering a building transitions the player to an interior instance instead of forcing every room into the overworld simulation.

## Repository Layout

```text
apps/
  client/       Phaser rendering, input, audio, UI, prediction
  server/       Colyseus rooms, authority, persistence adapters
packages/
  shared/       Network messages and cross-runtime contracts
  worldgen/     Seeded chunks, climate fields, biomes, placement
  content/      Data definitions for game content
  simulation/   Pure movement and gameplay calculations
```

The root `index.html`, `game.js`, `styles.css`, and current assets remain the playable V1 prototype.

## Runtime Model

### Client

Phaser 3 renders the world and handles controls, camera, animation, and local presentation. The client sends player intent, not authoritative positions or inventory mutations. Client prediction and reconciliation will be introduced after the basic authoritative loop is stable.

### Server

Colyseus manages one room per cooperative world. A room initially supports four players and runs a fixed simulation step. It validates inputs and broadcasts schema changes. The server process will be hosted separately because GitHub Pages can only host the static client.

### Persistence

The first development milestone uses in-memory rooms. The production persistence layer will use PostgreSQL with these broad records:

- worlds and generator versions
- player profiles and inventories
- chunk deltas
- bases and placed structures
- containers and resource depletion
- NPCs, factions, missions, and events

Every mutation must be idempotent or carry a unique operation identifier so reconnects cannot duplicate items or structures.

## BiomeGen

The world is divided into square chunks. Every tile samples global coordinates, so chunk borders are seamless. Layered deterministic fields create continental elevation, temperature, moisture, and corruption or hazard. These fields classify terrain into grassland, forest, desert, tundra, badlands, wasteland, water, and transition zones.

Generation is staged:

1. Sample continuous climate fields in world coordinates.
2. Classify terrain and calculate transition masks.
3. Reserve connected roads, rivers, and biome corridors.
4. Place landmarks using spacing and biome rules.
5. Stamp authored building and encounter templates.
6. Scatter resources, vegetation, enemies, and ambient details.
7. Apply persisted chunk deltas.

The generator version is stored with each world. Changes that alter generated results require a new version or an explicit migration.

## Authored Content

Procedural generation chooses and connects authored pieces; it does not invent good level design by itself. Buildings and major landmarks will be authored in Tiled with metadata for entrances, collision, searchable containers, enemy spawns, mission hooks, and loot tiers.

## Delivery Roadmap

### Phase 0: Foundation

- TypeScript workspace and automated checks
- authoritative four-player room
- deterministic chunk generation
- temporary biome rendering
- documented network and content contracts

### Phase 1: Survival Vertical Slice

- one polished biome
- one safe camp and modular wall/floor placement
- one enterable building with searchable containers
- one zombie archetype and one weapon
- loot, inventory, crafting, save, reconnect, and two-player validation

### Phase 2: Living World

- NPC schedules and dialogue
- random encounters, missions, factions, and hostile clans
- landmark discovery and dynamic events
- base workers, storage, defenses, and attacks

### Phase 3: World Breadth

- all target biomes and transitions
- biome-specific landmarks, buildings, resources, and hazards
- vehicles or travel systems if world scale proves they are needed
- improved art, animation, lighting, sound, and weather

### Phase 4: Scale and Operations

- database persistence and backups
- authentication, world ownership, invites, and moderation
- load testing, metrics, crash reporting, and deployment automation
- anti-cheat validation and exploit hardening

## First Vertical Slice Definition Of Done

Two browser clients can join the same private development world, move through identical generated terrain, enter the same building, search a synchronized container exactly once, gather materials, place a base wall, disconnect, reconnect, and observe the same state. This is the architecture proof before broader content production begins.

## Explicit Non-Goals For The Foundation

- porting every V1 feature before testing the new architecture
- public MMO servers
- seamless overworld interiors
- final art or final UI
- migrating prototype local-storage saves into V2
- generating every biome before one biome is fun and stable

