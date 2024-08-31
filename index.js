import express from "express";
import cors from "cors";
import logger from "./utils/logger";
import "dotenv/config";

const app = express();
const config = process.env;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Default response
app.get("/", (req, res) => {
  res.status(200);
  res.send('{"status": true, "message": "Server is up!", data: {}}');
});

// Teapot
app.get("/teapot", (req, res) => {
  execute("./modules/teapot", req, res);
});

// Server modules
app.get("/server/information", (req, res) => {
  execute("./modules/server/information", req, res);
});

// Auth modules
app.post("/auth/login", (req, res) => {
  execute("./modules/auth/login", req, res);
});
app.post("/auth/register", (req, res) => {
  execute("./modules/auth/register", req, res);
});

// Error
app.use((err, res) => {
  logger.error(err.stack);
  res.status(500);
  res.send('{"status": false, "message": "Server Error.", data: {}}');
});

// Create HTTP Server
const server = async () => {
  try {
    logger.info(
      `Server is running at http://${config.SERVER_HOSTNAME}:${config.SERVER_PORT}. \x1B[32mReady for connections!\x1B[0m`
    );
  } catch (error) {
    console.error("Initialization failed: " + error.message);
  }
};

app.listen(config.SERVER_PORT, config.SERVER_HOSTNAME, () => {
  server();
});

/**
 * 执行对应模块
 * @param module 模块
 * @param req
 * @param res
 */
const execute = async (module, req, res) => {
  logger.info(`Try module: ${module.substring(2)}`);
  const mod = await import(module);
  mod.default(req, res);
  logger.info(`Run module: ${module.substring(2)}`);
};
