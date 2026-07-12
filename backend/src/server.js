const express = require("express");
const mysql = require("mysql2/promise");
const client = require("prom-client");

const app = express();
app.use(express.json());

const PORT = process.env.API_PORT || 3000;
const INSTANCE = process.env.APP_INSTANCE || "backend";
const DB_HOST = process.env.DB_HOST || "mysql";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.MYSQL_DATABASE || "taskdb";
const DB_USER = process.env.MYSQL_USER || "taskuser";
const DB_PASS = process.env.MYSQL_PASSWORD || "taskpass123";

client.collectDefaultMetrics({ prefix: "nodejs_" });

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code", "instance"]
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code", "instance"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = req.route?.path || req.path || "unknown";
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode),
      instance: INSTANCE
    });
    httpRequestDuration.observe({
      method: req.method,
      route,
      status_code: String(res.statusCode),
      instance: INSTANCE
    }, seconds);
  });
  next();
});

let pool;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectWithRetry() {
  const retries = 20;
  for (let i = 1; i <= retries; i++) {
    try {
      pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASS,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      await pool.query("SELECT 1");
      console.log(`[${INSTANCE}] Connected to MySQL`);
      return;
    } catch (err) {
      console.error(`[${INSTANCE}] DB connection attempt ${i}/${retries} failed: ${err.message}`);
      await sleep(3000);
    }
  }
  throw new Error("Could not connect to MySQL after retries");
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up", instance: INSTANCE, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ status: "error", db: "down", instance: INSTANCE, error: err.message });
  }
});

app.get("/todos", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, title, done, created_at FROM todos ORDER BY id DESC LIMIT 50"
  );
  res.json({ instance: INSTANCE, count: rows.length, data: rows });
});

app.post("/todos", async (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title) {
    return res.status(400).json({ error: "title is required", instance: INSTANCE });
  }

  const [result] = await pool.execute(
    "INSERT INTO todos (title) VALUES (?)",
    [title]
  );

  res.status(201).json({ id: result.insertId, title, done: false, instance: INSTANCE });
});

app.patch("/todos/:id/done", async (req, res) => {
  const id = Number(req.params.id);
  const done = Boolean(req.body.done);

  const [result] = await pool.execute(
    "UPDATE todos SET done = ? WHERE id = ?",
    [done, id]
  );

  res.json({ updated: result.affectedRows, id, done, instance: INSTANCE });
});

app.post("/crash", (req, res) => {
  res.json({ message: `Crashing ${INSTANCE} now for restart-policy demo` });
  setTimeout(() => process.exit(1), 300);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.use((err, req, res, next) => {
  console.error(`[${INSTANCE}]`, err);
  res.status(500).json({ error: "internal server error", instance: INSTANCE });
});

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[${INSTANCE}] API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(`[${INSTANCE}] Startup failed`, err);
    process.exit(1);
  });
