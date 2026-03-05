import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import authRoutes from "./routes/auth.routes";
import testcaseRoutes from "./routes/testcase.routes";
import projectRoutes from "./routes/project.routes";
import notificationRoutes from "./modules/notifications/notification.routes";




dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), override: false });

const app = express();
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS ??
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS blocked for this origin"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-project-id"],
  })
);

const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "25mb";
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

app.use("/api/auth", authRoutes);
app.use("/api", testcaseRoutes);
app.use("/api", projectRoutes);
app.use("/api", notificationRoutes);


app.get("/", (req, res) => {
  res.send("TestTrack Pro API is running 🚀");
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
