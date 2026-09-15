import { createHandler } from "../_lib/vercel.js";
import { handleHealth } from "../_lib/handlers.js";

export default createHandler("GET", async () => handleHealth());
