import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import cors from "cors";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom";
import { MyLobbyRoom } from "./rooms/LobbyRoom";
import { BotRoom } from "./rooms/BotRoom";
import { GamesPrismaORMRepository } from "../prisma/repositories/game.repository";
import { DBActions } from "./rooms/DBActions";
import { ICharacterInitial } from "./rooms/schema/GameStates";
import { Room } from "colyseus";
import { MyRoomState } from "./rooms/schema/MyRoomState";
import { AuthController } from "./controllers/AuthController";
import { authRouter } from "./routes/auth";
import { characterRouter } from "./routes/character";
import { authMiddleware } from "./middlewares/authMiddleware";

export default config({
  initializeGameServer: (gameServer) => {
    /**
     * Define your room handlers:
     */

    gameServer.define("lobby_room", MyLobbyRoom);

    gameServer
      .define<any>("match_room", MyRoom)
      .on("create", async (room: MyRoom) => {
        const gameRepo = new GamesPrismaORMRepository();

        const gameDBResult = await gameRepo.createGame({
          room_id: room.roomId,
          rounds: "",
          winner: "",
          isRanked: undefined,
        });

        room.state.db_id = gameDBResult.id;
      })
      .on("dispose", (room: MyRoom) => {
        console.log("on dispose");
        const historyObj = JSON.parse(room.state.history);
        room.state.players.forEach((p) => {
          if (p.player_db_id)
            DBActions.addGameToPlayer(p.player_db_id, room.state.db_id);
        });
        DBActions.saveGameOnDB(room, historyObj);
      });

    gameServer
      .define<any>("bot_match_room", BotRoom)
      .on("create", async (room: MyRoom) => {
        const gameRepo = new GamesPrismaORMRepository();

        const gameDBResult = await gameRepo.createGame({
          room_id: room.roomId,
          rounds: "",
          winner: "",
        });

        room.state.db_id = gameDBResult.id;
      })
      .on("leave", (room: MyRoom) => {
        // console.log("Leaving", { room }, "Leaving");
      })
      .on("dispose", (room: MyRoom) => {
        console.log("on dispose");

        const historyObj = JSON.parse(room.state.history);
        room.state.players.forEach((p) => {
          if (p.player_db_id)
            DBActions.addGameToPlayer(p.player_db_id, room.state.db_id);
        });
        DBActions.saveGameOnDB(room, historyObj);
      });
  },

  initializeExpress: (app) => {
    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */

    app.use(cors())

    app.get("/hello_world", (req, res) => {
      res.send("It's time to kick ass and chew bubblegum!");
    });

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground);
    }

    /**
     * Use @colyseus/monitor
     * It is recommended to protect this route with a password
     * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
     */
    app.use("/colyseus", monitor());

    app.use("/api/auth", authRouter);

    app.use(authMiddleware);
    app.use("/api/character", characterRouter);
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
});
