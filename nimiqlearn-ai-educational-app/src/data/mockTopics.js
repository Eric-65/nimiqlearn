/* ============================================================
   NimiqLearn — Curriculum topic tree
   Each leaf topic carries starter content used by the
   deterministic lesson engine (the AI augments it when ready).
   ============================================================ */

export const TOPIC_TREE = [
  {
    id: "math",
    name: "Mathematics",
    description: "From equations to proofs — build a rigorous math foundation.",
    children: [
      {
        id: "algebra",
        name: "Algebra",
        description: "The language of patterns and unknown quantities.",
        children: [
          { id: "linear-equations", name: "Linear equations", description: "Solve equations of the form ax + b = c.", difficulty: 1 },
          { id: "quadratics", name: "Quadratics", description: "Parabolas, factoring, and the quadratic formula.", difficulty: 2 },
          { id: "functions", name: "Functions", description: "Mappings, domain & range, and function notation.", difficulty: 2 },
        ],
      },
      {
        id: "geometry",
        name: "Geometry",
        description: "Shapes, space, and the logic of proofs.",
        children: [
          { id: "angles", name: "Angles", description: "Complementary, supplementary, and parallel-line angles.", difficulty: 1 },
          { id: "proofs", name: "Proofs", description: "Constructing logical two-column geometric proofs.", difficulty: 3 },
        ],
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    description: "Physics and the laws that govern motion and energy.",
    children: [
      {
        id: "physics",
        name: "Physics",
        description: "Force, motion, energy, and how the universe behaves.",
        children: [
          { id: "newtons-second-law", name: "Newton's second law", description: "F = ma — how force, mass, and acceleration relate.", difficulty: 2 },
          { id: "energy-work", name: "Energy & work", description: "Kinetic and potential energy, and the work-energy theorem.", difficulty: 2 },
        ],
      },
    ],
  },
  {
    id: "cs",
    name: "Computer Science",
    description: "Programming and the ideas behind modern AI.",
    children: [
      {
        id: "programming",
        name: "Programming",
        description: "Write code, reason about algorithms, debug like a pro.",
        children: [
          { id: "python-basics", name: "Python basics", description: "Variables, loops, conditionals, and functions.", difficulty: 1 },
          { id: "ai-fundamentals", name: "AI fundamentals", description: "What models are, training data, and inference.", difficulty: 2 },
        ],
      },
    ],
  },
];

/* Leaf-topic starter content used by the deterministic engine */
export const TOPIC_CONTENT = {
  "linear-equations": {
    definition:
      "A linear equation is an equation of the form ax + b = c, where the variable x appears only to the first power. Solving it means isolating x using inverse operations on both sides.",
    keyPoints: [
      "Whatever you do to one side, do to the other (balance).",
      "Undo addition with subtraction and multiplication with division.",
      "Check your answer by substituting it back in.",
    ],
    misconception: "Many learners add/subtract a term on only one side, breaking the balance of the equation.",
    analogy: "Think of the equation as a balance scale — both pans must always carry the same total weight.",
    example: "Solve 3x + 5 = 20. Subtract 5 from both sides: 3x = 15. Divide both sides by 3: x = 5.",
  },
  quadratics: {
    definition:
      "A quadratic is a polynomial of degree 2, ax² + bx + c = 0. Its graph is a parabola, and it can have 0, 1, or 2 real roots.",
    keyPoints: [
      "Standard form: ax² + bx + c = 0.",
      "Roots can be found by factoring, completing the square, or the quadratic formula.",
      "The discriminant b² − 4ac tells you how many real roots exist.",
    ],
    misconception: "Learners often forget the ± sign when taking square roots, losing one of the two solutions.",
    analogy: "A parabola is like a ball thrown in the air — it goes up, peaks, and comes down, crossing the ground line at most twice.",
    example: "Solve x² − 5x + 6 = 0 by factoring: (x − 2)(x − 3) = 0, so x = 2 or x = 3.",
  },
  functions: {
    definition:
      "A function is a rule that assigns exactly one output to each input. We write f(x) for the output of function f at input x.",
    keyPoints: [
      "Each input maps to exactly one output (vertical line test).",
      "Domain = allowed inputs; range = possible outputs.",
      "f(x) = 2x + 1 doubles the input and adds one.",
    ],
    misconception: "Learners confuse the function itself with its output, or think any curve is a function even when it fails the vertical line test.",
    analogy: "A function is a vending machine: you press one button (input) and get exactly one snack (output).",
    example: "For f(x) = x², f(3) = 9. The vertical line test confirms f is a function.",
  },
  angles: {
    definition:
      "Complementary angles sum to 90°. Supplementary angles sum to 180°. Parallel lines cut by a transversal create equal alternate and corresponding angles.",
    keyPoints: [
      "Complementary = 90°, supplementary = 180°.",
      "Corresponding and alternate interior angles are equal on parallel lines.",
      "Angles on a straight line sum to 180°.",
    ],
    misconception: "Learners mix up complementary (90°) and supplementary (180°) — a classic swap.",
    analogy: "Two complementary angles are two slices that together form a right-angled corner; supplementary ones form a straight line.",
    example: "If angle A = 35° and it is complementary to B, then B = 90° − 35° = 55°.",
  },
  proofs: {
    definition:
      "A geometric proof is a logical chain of statements, each justified by a definition, postulate, or previously proven theorem, ending at the claim you set out to prove.",
    keyPoints: [
      "Start from given information.",
      "Each statement needs a reason (definition, postulate, theorem).",
      "Work step-by-step toward the conclusion.",
    ],
    misconception: "Learners assert that a shape 'looks' equal instead of citing a congruence rule like SSS or SAS.",
    analogy: "A proof is like building with LEGO: every brick must click into an existing one, or the whole tower is unstable.",
    example: "Given AB = CD and CD = EF, by transitivity AB = EF. That is a complete mini-proof.",
  },
  "newtons-second-law": {
    definition:
      "Newton's second law states that the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass: F_net = m·a.",
    keyPoints: [
      "Force is measured in newtons (N): 1 N = 1 kg·m/s².",
      "Acceleration points in the same direction as the net force.",
      "The same force on a heavier object produces a smaller acceleration.",
    ],
    misconception: "Learners confuse mass and weight, or think a constant velocity means zero net force is needed (it is zero net force, not zero force).",
    analogy: "Pushing a shopping cart: a full cart (more mass) accelerates less than an empty cart under the same push.",
    example: "A 2 kg object with a net force of 10 N accelerates at a = F/m = 10/2 = 5 m/s².",
  },
  "energy-work": {
    definition:
      "Work is done when a force moves an object over a distance: W = F·d·cos(θ). Energy is the capacity to do work; kinetic energy is ½mv² and gravitational potential energy is mgh.",
    keyPoints: [
      "Work transfers energy from one form to another.",
      "Kinetic energy grows with the square of speed.",
      "Energy is conserved — it changes form but is not destroyed.",
    ],
    misconception: "Learners think holding a heavy object still is 'work' — but without displacement, no work is done in the physics sense.",
    analogy: "Energy is like money in different currencies: kinetic, potential, thermal — all convertible, never created from nothing.",
    example: "A 3 kg mass at 10 m/s has kinetic energy ½·3·10² = 150 J.",
  },
  "python-basics": {
    definition:
      "Python basics cover variables, data types, conditionals (if/else), loops (for/while), and defining functions with def.",
    keyPoints: [
      "Variables store values; indentation defines blocks.",
      "if/elif/else choose between paths.",
      "for loops iterate over sequences; while loops run until a condition is false.",
    ],
    misconception: "Learners mix up = (assignment) with == (comparison), or forget that indentation is meaningful in Python.",
    analogy: "A Python function is like a recipe: define the steps once, then call it any time with different ingredients (arguments).",
    example: "def double(x): return x * 2 — calling double(21) returns 42.",
  },
  "ai-fundamentals": {
    definition:
      "AI models learn patterns from training data and then perform inference: applying those patterns to new inputs. This app runs a small language model directly in your browser.",
    keyPoints: [
      "Training = learning patterns from data; inference = using them.",
      "Models don't 'know' — they predict likely next tokens.",
      "Small models can run locally in the browser via WebGPU or WASM.",
    ],
    misconception: "Learners think the model understands truth — it estimates probability, so it can be confidently wrong.",
    analogy: "A language model is like an extremely well-read autocomplete: it produces the most likely continuation, not a verified fact.",
    example: "Given 'The capital of France is', a model continues with 'Paris' because it is the most probable completion in its training data.",
  },
};

/* Flatten helpers -------------------------------------------------- */

export function flattenTopics(tree = TOPIC_TREE, parentId = null, depth = 0, acc = []) {
  for (const node of tree) {
    const { children, ...leaf } = node;
    acc.push({ ...leaf, parentId, depth });
    if (children) flattenTopics(children, node.id, depth + 1, acc);
  }
  return acc;
}

export const ALL_TOPICS = flattenTopics();

export const LEAF_TOPICS = ALL_TOPICS.filter((t) => t.depth === 2);

export function findTopic(id) {
  return ALL_TOPICS.find((t) => t.id === id) || null;
}

export function findTopicPath(id) {
  const topic = findTopic(id);
  if (!topic) return [];
  const path = [topic];
  let parentId = topic.parentId;
  let guard = 0;
  while (parentId && guard < 6) {
    const parent = findTopic(parentId);
    if (!parent) break;
    path.unshift(parent);
    parentId = parent.parentId;
    guard += 1;
  }
  return path;
}
