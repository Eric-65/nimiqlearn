/* ============================================================
   NimiqLearn — Learning Economy packs
   Paid via Nimiq Pay. NIM is supported natively; USDT is not
   available in the current Mini App SDK (see
   docs/nimiq-pay-integration.md). Recipients are educator
   addresses configured by the creator.
   ============================================================ */

export const EDU_RECIPIENT = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";

export const LEARNING_PACKS = [
  {
    id: "pack-python",
    emoji: "🐍",
    title: "Python Mastery Pack",
    tagline: "From your first variable to clean, confident functions.",
    description:
      "A guided path through Python basics with adaptive exercises, misconception-targeted challenges, and spaced reviews.",
    purpose: "Educational learning pack",
    price: 0.5,
    asset: "NIM",
    recipient: EDU_RECIPIENT,
    category: "Programming",
    creator: "Ada Learning Co.",
    duration: "3 weeks",
    difficulty: "Beginner",
    outcomes: ["Write clean Python functions", "Fix bugs with confidence", "Explain code to others"],
    features: ["12 adaptive lessons", "Code challenges", "ForgetMeNot reviews", "Certificate"],
    popular: true,
  },
  {
    id: "pack-exam",
    emoji: "📘",
    title: "Exam Prep Pack",
    tagline: "Structured revision for your next big exam.",
    description:
      "Exam-style questions with AI explanations that adapt to the gaps the AI finds in your explanations.",
    purpose: "Exam preparation course",
    price: 2.5,
    asset: "NIM",
    recipient: EDU_RECIPIENT,
    category: "Revision",
    creator: "GradDesk Tutors",
    duration: "2 weeks",
    difficulty: "Intermediate",
    outcomes: ["Score higher on practice exams", "Target your weakest topics", "Build exam stamina"],
    features: ["Mock exam sets", "Weak-spot targeting", "Performance analytics"],
    popular: false,
  },
  {
    id: "pack-ai-interview",
    emoji: "🤖",
    title: "AI Interview Practice",
    tagline: "ExplainBack drills for machine-learning interviews.",
    description:
      "Practice explaining ML concepts out loud. The AI evaluates your explanations and tells you what an interviewer would probe next.",
    purpose: "Interview preparation",
    price: 1.2,
    asset: "NIM",
    recipient: EDU_RECIPIENT,
    category: "Career",
    creator: "ML Mentor Circle",
    duration: "1 week",
    difficulty: "Advanced",
    outcomes: ["Explain ML concepts clearly", "Handle follow-up questions", "Sound confident under pressure"],
    features: ["ExplainBack sessions", "Interviewer-style feedback", "Mastery tracking"],
    popular: false,
  },
  {
    id: "pack-math",
    emoji: "🧮",
    title: "Beginner Mathematics",
    tagline: "Numbers, patterns, and problem-solving made gentle.",
    description:
      "A friendly, low-pressure path for absolute beginners with plenty of analogies and worked examples.",
    purpose: "Foundational math course",
    price: 0.3,
    asset: "NIM",
    recipient: EDU_RECIPIENT,
    category: "Foundations",
    creator: "Numbers First",
    duration: "4 weeks",
    difficulty: "Beginner",
    outcomes: ["Build number intuition", "Solve word problems", "Gain confidence with math"],
    features: ["Gentle pacing", "Visual analogies", "Streak rewards"],
    popular: false,
  },
  {
    id: "pack-language",
    emoji: "🗣️",
    title: "Language Learning Path",
    tagline: "Build sentences, get feedback, review before you forget.",
    description:
      "A practical speaking-first path that uses spaced review so vocabulary sticks long after the lesson ends.",
    purpose: "Language course",
    price: 0.8,
    asset: "NIM",
    recipient: EDU_RECIPIENT,
    category: "Languages",
    creator: "SpeakEasy Studio",
    duration: "6 weeks",
    difficulty: "All levels",
    outcomes: ["Hold a basic conversation", "Remember vocabulary longer", "Improve pronunciation"],
    features: ["Speaking prompts", "Spaced vocabulary", "Daily reviews"],
    popular: false,
  },
];

export function findPack(id) {
  return LEARNING_PACKS.find((p) => p.id === id) || null;
}
