import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import router from "./routes/apiRoutes.js";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// connect DB
connectDB();

// router connection
app.use("/api", router);

// Test Route
app.get("/", (req: Request, res: Response) => {
  res.send("ProfitLens AI Backend is running successfully!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
