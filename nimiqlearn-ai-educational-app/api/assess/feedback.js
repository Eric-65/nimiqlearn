import { createHandler } from "../_lib/vercel.js";
import { handleAssessFeedback } from "../_lib/handlers.js";

export default createHandler("POST", handleAssessFeedback);
