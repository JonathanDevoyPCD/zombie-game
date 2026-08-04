import { defineRoom, defineServer } from "@colyseus/core";
import { WORLD_ROOM } from "@last-survivor/shared";
import type { Request, Response } from "express";
import { WorldRoom } from "./rooms/WorldRoom.js";

const port = Number(process.env.PORT ?? 2567);

const server = defineServer({
  rooms: {
    [WORLD_ROOM]: defineRoom(WorldRoom).filterBy(["worldId"]),
  },
  express: (app) => {
    app.get("/health", (_request: Request, response: Response) => {
      response.json({ service: "last-survivor-server", status: "ok" });
    });
  },
});

await server.listen(port);
console.log(`Last Survivor server listening on http://127.0.0.1:${port}`);
