import { createHandler } from "../_lib/vercel.js";
import { handleLearnActivity } from "../_lib/handlers.js";

export default createHandler("POST", handleLearnActivity);
