import { createHandler } from "../_lib/vercel.js";
import { handleTutorFeedback } from "../_lib/handlers.js";

export default createHandler("POST", handleTutorFeedback);
