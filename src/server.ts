import dotenv from "dotenv";
dotenv.config();
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import router from "./routes/apiRoutes";
import authRouters from "./routes/auth.routes";
import businessRoutes from "./routes/business.routes";

const app: Application = express();
const PORT = process.env.PORT || 5000;
console.log("OpenAI API Key Loaded:", Boolean(process.env.OPENAI_API_KEY));
// Middleware
app.use(express.json());
app.use(cors());

// connect DB
connectDB();

app.use("/api/auth", authRouters);
app.use("/api/business", businessRoutes);

// router connection
app.use("/api", router);

// Test Route
app.get("/", (req: Request, res: Response) => {
  res.send("ProfitLens AI Backend is running successfully!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
