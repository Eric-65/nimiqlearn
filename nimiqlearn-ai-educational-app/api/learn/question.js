import { createHandler } from "../_lib/vercel.js";
import { handleLessonQuestion } from "../_lib/handlers.js";

export default createHandler("POST", handleLessonQuestion);
