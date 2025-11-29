import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import { ContainerController } from "./controllers/ContainerController";
import { ZoneController } from "./controllers/ZoneController";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Container API",
      version: "1.0.0",
      description: "API для учёта контейнеров и зон хранения",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
      },
    ],
  },
  apis: ["./src/index.ts", "./src/controllers/*.ts"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.connect((err) => {
  if (err) {
    return console.error("Ошибка подключения к базе данных", err.stack);
  }
  console.log("Подключение к PostgreSQL успешно!");
});

const containerCtrl = ContainerController(pool);
const zoneCtrl = ZoneController(pool);

io.on("connection", (socket) => {
  console.log("Клиент подключён через WebSocket");

  socket.on("disconnect", () => {
    console.log("Клиент отключился");
  });
});


/**
 * @swagger
 * /containers:
 *   get:
 *     summary: Получить все контейнеры
 *     responses:
 *       200:
 *         description: Список контейнеров
 */
app.get("/containers", containerCtrl.getAll);

/**
 * @swagger
 * /containers:
 *   post:
 *     summary: Добавить новый контейнер
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               number:
 *                 type: string
 *     responses:
 *       200:
 *         description: Новый контейнер создан
 */
app.post("/containers", async (req: Request, res: Response) => {
  try {
    const { type, number } = req.body;
    const uniqueNumber = number || `C-${Date.now()}`;
    const result = await pool.query(
      "INSERT INTO containers (number, type, status, arrival_time) VALUES ($1, $2, $3, NOW()) RETURNING *",
      [uniqueNumber, type || "тип 1", "new"]
    );
    io.emit("containerAdded", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка при добавлении контейнера");
  }
});

/**
 * @swagger
 * /containers/{id}:
 *   patch:
 *     summary: Обновить статус контейнера
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID контейнера
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Статус контейнера обновлён
 */
app.patch("/containers/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      "UPDATE containers SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).send("Контейнер не найден");
    io.emit("containerUpdated", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка при обновлении контейнера");
  }
});

/**
 * @openapi
 * /zones:
 *   get:
 *     summary: Список всех зон
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   capacity:
 *                     type: integer
 *                   current_load:
 *                     type: integer
 *                   type:
 *                     type: string
 */
app.get("/zones", zoneCtrl.getAll);

/**
 * @openapi
 * /zones/{id}/assign:
 *   post:
 *     summary: Назначение контейнера в зону
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID зоны
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               containerId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Контейнер успешно назначен
 *       400:
 *         description: Zone Overloaded
 *       404:
 *         description: Зона или контейнер не найдены
 */
app.post("/zones/:id/assign", async (req: Request, res: Response) => {
  const { id: zoneId } = req.params;
  const { containerId } = req.body;
  try {
    const zoneResult = await pool.query("SELECT * FROM zones WHERE id = $1", [zoneId]);
    if (zoneResult.rows.length === 0) return res.status(404).send("Зона не найдена");

    const zone = zoneResult.rows[0];
    if (zone.current_load >= zone.capacity) return res.status(400).send("Zone Overloaded");

    const containerResult = await pool.query(
      "UPDATE containers SET zone_id = $1 WHERE id = $2 RETURNING *",
      [zoneId, containerId]
    );
    if (containerResult.rows.length === 0) return res.status(404).send("Контейнер не найден");

    await pool.query(
      "UPDATE zones SET current_load = current_load + 1 WHERE id = $1",
      [zoneId]
    );

    io.emit("containerAssigned", containerResult.rows[0]);
    res.json(containerResult.rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message);
      res.status(500).send(err.message);
    } else {
      console.error(err);
      res.status(500).send("Неизвестная ошибка");
    }
  }
});

app.post("/containers/:id/ship", async (req, res) => {
  const { id } = req.params;
  try {
    const containerResult = await pool.query(
      "SELECT * FROM containers WHERE id = $1",
      [id]
    );
    if (containerResult.rows.length === 0) return res.status(404).send("Контейнер не найден");

    const container = containerResult.rows[0];

    await pool.query(
      "UPDATE containers SET status = 'shipped' WHERE id = $1",
      [id]
    );

    if (container.zone_id) {
      await pool.query(
        "UPDATE zones SET current_load = current_load - 1 WHERE id = $1 AND current_load > 0",
        [container.zone_id]
      );
    }

    
    io.emit("containerShipped", { id });
    res.json({ message: "Контейнер отгружен", containerId: id });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message);
      res.status(500).send(err.message);
    } else {
      console.error(err);
      res.status(500).send("Неизвестная ошибка");
    }
  }
});

app.get("/", (req, res) => {
  res.send("API работает!");
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

