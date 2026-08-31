/* ============================================================
   NimiqLearn — ExplainBack demo examples (DEVELOPMENT SAMPLE ONLY)
   ------------------------------------------------------------
   A tiny, hand-written sample in the same normalized shape the
   offline ExplainBack pipeline produces from the Automatic Short
   Answer Grading dataset (see training/datasets/README.md).

   This is NOT the Kaggle dataset. It exists so the demo mode and
   assessmentService's rubric baseline can be exercised without
   any network access or the real dataset being present. Scores
   here are illustrative, not derived from real grading data.
   ============================================================ */

export const EXPLAIN_BACK_DEMO_EXAMPLES = [
  {
    topic: "linear-equations",
    question: "What does it mean to solve a linear equation like 3x + 5 = 20?",
    referenceAnswer:
      "It means isolating x using inverse operations while keeping both sides of the equation balanced, until x stands alone.",
    learnerAnswer:
      "You move the 5 to the other side and then divide by 3 to get x by itself.",
    score: 4,
    maxScore: 5,
  },
  {
    topic: "linear-equations",
    question: "Why must you do the same operation to both sides of an equation?",
    referenceAnswer:
      "Because the equation represents a balance — changing one side without the other breaks the equality.",
    learnerAnswer: "So the numbers stay the same I think.",
    score: 1,
    maxScore: 5,
  },
  {
    topic: "quadratics",
    question: "What is the discriminant and what does it tell you?",
    referenceAnswer:
      "b² − 4ac. It tells you how many real roots a quadratic has: two if positive, one if zero, none if negative.",
    learnerAnswer:
      "It's part of the quadratic formula, b squared minus 4ac, and it tells you how many solutions there are.",
    score: 4,
    maxScore: 5,
  },
  {
    topic: "functions",
    question: "How do you tell whether a graph represents a function?",
    referenceAnswer:
      "Use the vertical line test — if any vertical line crosses the graph more than once, it is not a function, since each input needs exactly one output.",
    learnerAnswer: "If it passes the vertical line test.",
    score: 2,
    maxScore: 5,
  },
  {
    topic: "newtons-second-law",
    question: "Explain Newton's second law in your own words.",
    referenceAnswer:
      "Net force equals mass times acceleration (F = ma). A larger force produces more acceleration; a larger mass resists acceleration more.",
    learnerAnswer:
      "Force equals mass times acceleration, so heavier things need more force to speed up the same amount.",
    score: 5,
    maxScore: 5,
  },
  {
    topic: "newtons-second-law",
    question: "Does constant velocity mean there is no force acting on an object?",
    referenceAnswer:
      "No — it means the net force is zero. Individual forces can still act, as long as they cancel out.",
    learnerAnswer: "Yes, if it's moving at a constant speed there's no force on it.",
    score: 1,
    maxScore: 5,
  },
  {
    topic: "python-basics",
    question: "What is the difference between = and == in Python?",
    referenceAnswer:
      "= assigns a value to a variable, while == compares two values and returns True or False.",
    learnerAnswer: "= sets a variable and == checks if two things are equal.",
    score: 5,
    maxScore: 5,
  },
  {
    topic: "ai-fundamentals",
    question: "What is the difference between training and inference?",
    referenceAnswer:
      "Training is when a model learns patterns from data by adjusting its parameters; inference is using the already-trained model to make predictions on new input.",
    learnerAnswer: "Training is teaching the model and inference is using it.",
    score: 3,
    maxScore: 5,
  },
];
