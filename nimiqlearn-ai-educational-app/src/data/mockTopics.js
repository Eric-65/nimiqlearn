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
          { id: "inequalities", name: "Inequalities", description: "Comparing quantities and why dividing by a negative flips the sign.", difficulty: 2 },
          { id: "exponents", name: "Exponents & powers", description: "Repeated multiplication, exponent laws, and scientific notation.", difficulty: 1 },
        ],
      },
      {
        id: "geometry",
        name: "Geometry",
        description: "Shapes, space, and the logic of proofs.",
        children: [
          { id: "angles", name: "Angles", description: "Complementary, supplementary, and parallel-line angles.", difficulty: 1 },
          { id: "proofs", name: "Proofs", description: "Constructing logical two-column geometric proofs.", difficulty: 3 },
          { id: "pythagorean-theorem", name: "Pythagorean theorem", description: "a² + b² = c² and how to find a missing side.", difficulty: 2 },
          { id: "circles", name: "Circles & area", description: "Radius, diameter, circumference, and area of a circle.", difficulty: 1 },
        ],
      },
      {
        id: "statistics",
        name: "Statistics & Probability",
        description: "Summarising data and reasoning about uncertainty.",
        children: [
          { id: "descriptive-stats", name: "Mean, median & mode", description: "Three ways to describe the centre of a data set.", difficulty: 1 },
          { id: "probability-basics", name: "Probability basics", description: "Measuring how likely an event is, from 0 to 1.", difficulty: 2 },
        ],
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    description: "The laws behind motion, matter, and life.",
    children: [
      {
        id: "physics",
        name: "Physics",
        description: "Force, motion, energy, and how the universe behaves.",
        children: [
          { id: "newtons-second-law", name: "Newton's second law", description: "F = ma — how force, mass, and acceleration relate.", difficulty: 2 },
          { id: "energy-work", name: "Energy & work", description: "Kinetic and potential energy, and the work-energy theorem.", difficulty: 2 },
          { id: "waves-sound", name: "Waves & sound", description: "Frequency, wavelength, and how sound travels.", difficulty: 2 },
          { id: "electricity-basics", name: "Electricity basics", description: "Current, voltage, resistance, and Ohm's law.", difficulty: 2 },
        ],
      },
      {
        id: "chemistry",
        name: "Chemistry",
        description: "What matter is made of and how it combines.",
        children: [
          { id: "atoms-elements", name: "Atoms & elements", description: "Protons, neutrons, electrons, and the periodic table.", difficulty: 1 },
          { id: "chemical-bonding", name: "Chemical bonding", description: "Ionic and covalent bonds, and why atoms bond at all.", difficulty: 2 },
        ],
      },
      {
        id: "biology",
        name: "Biology",
        description: "The machinery of living things.",
        children: [
          { id: "cell-structure", name: "Cell structure", description: "Organelles and the division of labour inside a cell.", difficulty: 1 },
          { id: "dna-genetics", name: "DNA & genetics", description: "How traits are stored, copied, and inherited.", difficulty: 2 },
        ],
      },
    ],
  },
  {
    id: "cs",
    name: "Computer Science",
    description: "Programming, algorithms, and the ideas behind modern AI.",
    children: [
      {
        id: "programming",
        name: "Programming",
        description: "Write code, reason about algorithms, debug like a pro.",
        children: [
          { id: "python-basics", name: "Python basics", description: "Variables, loops, conditionals, and functions.", difficulty: 1 },
          { id: "ai-fundamentals", name: "AI fundamentals", description: "What models are, training data, and inference.", difficulty: 2 },
          { id: "data-structures", name: "Data structures", description: "Arrays, dictionaries, stacks, and when to use each.", difficulty: 2 },
          { id: "recursion", name: "Recursion", description: "Functions that call themselves, and the base case that stops them.", difficulty: 3 },
          { id: "big-o-notation", name: "Big-O notation", description: "Describing how an algorithm scales as input grows.", difficulty: 3 },
        ],
      },
      {
        id: "web-data",
        name: "Web & Data",
        description: "How data is stored and how the web actually works.",
        children: [
          { id: "sql-databases", name: "SQL & databases", description: "Tables, queries, and asking a database questions.", difficulty: 2 },
          { id: "how-web-works", name: "How the web works", description: "Requests, responses, DNS, and what happens when you open a page.", difficulty: 1 },
        ],
      },
    ],
  },
  {
    id: "nimiq",
    name: "Nimiq",
    description: "The chain NimiqLearn runs on, the coin it moves, and the wallet that carries it.",
    children: [
      {
        id: "nimiq-essentials",
        name: "Nimiq essentials",
        description: "How the network, the coin and the wallet fit together.",
        children: [
          { id: "nimiq-blockchain", name: "Nimiq blockchain", description: "A browser-first proof-of-stake chain, and what consensus means for it.", difficulty: 1 },
          { id: "nim-token", name: "NIM", description: "The coin Nimiq runs on, and the Luna it is counted in.", difficulty: 1 },
          { id: "nimiq-pay", name: "Nimiq Pay", description: "The wallet that hosts mini apps, and the sandbox they run in.", difficulty: 2 },
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
      "AI models learn patterns from training data and then perform inference: applying those patterns to new inputs. This app sends your explanation to a hosted model and grades the reply.",
    keyPoints: [
      "Training = learning patterns from data; inference = using them.",
      "Models don't 'know' — they predict likely next tokens.",
      "Small models can run locally in the browser via WebGPU or WASM.",
    ],
    misconception: "Learners think the model understands truth — it estimates probability, so it can be confidently wrong.",
    analogy: "A language model is like an extremely well-read autocomplete: it produces the most likely continuation, not a verified fact.",
    example: "Given 'The capital of France is', a model continues with 'Paris' because it is the most probable completion in its training data.",
  },
  inequalities: {
    definition:
      "An inequality compares two quantities that need not be equal, using <, >, ≤, or ≥. You solve it much like an equation, but multiplying or dividing both sides by a negative number reverses the direction of the sign.",
    keyPoints: [
      "Solutions are ranges of values, not a single number.",
      "Multiplying or dividing by a negative flips the inequality sign.",
      "An open circle on a number line means 'not included'; a filled circle means 'included'.",
    ],
    misconception: "Learners solve inequalities exactly like equations and forget to flip the sign after dividing by a negative.",
    analogy: "An equation names one exact spot; an inequality fences off a whole stretch of the number line.",
    example: "Solve −2x > 6. Divide both sides by −2 and flip the sign: x < −3.",
  },
  exponents: {
    definition:
      "An exponent tells you how many times to multiply a base by itself: aⁿ means a multiplied n times. Exponent laws let you combine powers without expanding them.",
    keyPoints: [
      "aᵐ × aⁿ = aᵐ⁺ⁿ, and aᵐ ÷ aⁿ = aᵐ⁻ⁿ.",
      "Any nonzero number to the power 0 equals 1.",
      "A negative exponent means a reciprocal: a⁻ⁿ = 1/aⁿ.",
    ],
    misconception: "Learners multiply the base by the exponent (reading 2³ as 6) instead of multiplying the base by itself three times.",
    analogy: "An exponent is a folding instruction: each fold doubles the layers, so growth compounds fast.",
    example: "2³ × 2⁴ = 2⁷ = 128, because you add the exponents when the base is the same.",
  },
  "pythagorean-theorem": {
    definition:
      "In any right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: a² + b² = c², where c is the side opposite the right angle.",
    keyPoints: [
      "It only applies to right-angled triangles.",
      "c is always the hypotenuse — the longest side, opposite the right angle.",
      "Rearrange to find a missing leg: a² = c² − b².",
    ],
    misconception: "Learners label any side as c instead of the hypotenuse, or apply the theorem to triangles with no right angle.",
    analogy: "The squares built on the two short sides can be cut up and rearranged to exactly fill the square on the long side.",
    example: "A triangle with legs 3 and 4 has hypotenuse √(9 + 16) = √25 = 5.",
  },
  circles: {
    definition:
      "A circle is the set of all points a fixed distance (the radius) from a centre. Its circumference is 2πr and its area is πr², where r is the radius.",
    keyPoints: [
      "Diameter = 2 × radius.",
      "Circumference (the distance around) = 2πr = πd.",
      "Area (the space inside) = πr².",
    ],
    misconception: "Learners substitute the diameter into formulas that expect the radius, doubling or quadrupling their answer.",
    analogy: "Circumference is the length of string around the rim; area is the amount of paper needed to cover the disc.",
    example: "A circle with radius 3 has circumference 2π(3) ≈ 18.85 and area π(3²) ≈ 28.27.",
  },
  "descriptive-stats": {
    definition:
      "Mean, median, and mode are three measures of the centre of a data set. The mean is the average, the median is the middle value when sorted, and the mode is the most frequent value.",
    keyPoints: [
      "Mean = sum of values ÷ number of values.",
      "Median = middle value after sorting (average the two middles if the count is even).",
      "The median resists outliers; the mean does not.",
    ],
    misconception: "Learners compute the median without sorting the data first, or assume the mean is always the best summary even when extreme outliers distort it.",
    analogy: "The mean is the balance point of a see-saw; the median is the person standing in the middle of a queue.",
    example: "For 2, 3, 3, 10: mean = 4.5, median = 3, mode = 3. The single large value pulls the mean above every other measure.",
  },
  "probability-basics": {
    definition:
      "Probability measures how likely an event is, on a scale from 0 (impossible) to 1 (certain). For equally likely outcomes it is the number of favourable outcomes divided by the total number of outcomes.",
    keyPoints: [
      "P(event) = favourable outcomes ÷ total outcomes.",
      "All probabilities lie between 0 and 1 and sum to 1 across all outcomes.",
      "Independent events don't influence each other; multiply their probabilities for both to happen.",
    ],
    misconception: "Learners believe past results change future odds — the 'gambler's fallacy' that a coin is 'due' for tails after several heads.",
    analogy: "Probability is the share of a pie chart an outcome occupies over the long run, not a promise about the next single try.",
    example: "Rolling a 4 on a fair die is 1/6 ≈ 0.167. Rolling two 4s in a row is 1/6 × 1/6 = 1/36.",
  },
  "waves-sound": {
    definition:
      "A wave transfers energy without transferring matter. Sound is a longitudinal wave: air molecules compress and spread apart, carrying vibration from a source to your ear.",
    keyPoints: [
      "Frequency (Hz) sets pitch; amplitude sets loudness.",
      "Wave speed = frequency × wavelength.",
      "Sound needs a medium — it cannot travel through a vacuum.",
    ],
    misconception: "Learners think the air itself travels from the speaker to the ear; only the disturbance moves, while molecules oscillate in place.",
    analogy: "A wave is like a stadium crowd doing 'the wave' — the pattern races around the stands while each person stays in their seat.",
    example: "A 340 Hz sound in air (speed ≈ 340 m/s) has wavelength 340 ÷ 340 = 1 metre.",
  },
  "electricity-basics": {
    definition:
      "Current is the flow of electric charge, voltage is the push that drives it, and resistance opposes it. Ohm's law ties them together: V = IR.",
    keyPoints: [
      "Voltage (V) is measured in volts, current (I) in amps, resistance (R) in ohms.",
      "V = IR — raising resistance at fixed voltage lowers current.",
      "In a series circuit current is the same everywhere; in parallel, voltage is.",
    ],
    misconception: "Learners treat voltage as something that 'flows' through a wire, when it is the potential difference between two points that causes charge to flow.",
    analogy: "Voltage is water pressure, current is the flow rate, and resistance is a narrow section of pipe.",
    example: "A 12 V supply across a 4 Ω resistor drives a current of 12 ÷ 4 = 3 amps.",
  },
  "atoms-elements": {
    definition:
      "An atom is the smallest unit of an element, built from protons and neutrons in a nucleus surrounded by electrons. The number of protons — the atomic number — defines which element it is.",
    keyPoints: [
      "Protons are positive, electrons negative, neutrons neutral.",
      "Atomic number (protons) identifies the element; mass number counts protons + neutrons.",
      "Isotopes are the same element with different neutron counts.",
    ],
    misconception: "Learners think changing the number of electrons or neutrons changes the element — only the proton count does that.",
    analogy: "The proton count is an element's ID number: change it and you have a different substance entirely.",
    example: "Carbon always has 6 protons. Carbon-12 and carbon-14 are both carbon, differing only by two neutrons.",
  },
  "chemical-bonding": {
    definition:
      "Atoms bond to reach a more stable electron arrangement. Ionic bonds transfer electrons between atoms, creating charged ions that attract; covalent bonds share electrons between atoms.",
    keyPoints: [
      "Ionic bonds usually form between a metal and a non-metal.",
      "Covalent bonds form between non-metals sharing electron pairs.",
      "Atoms bond to fill their outer electron shell.",
    ],
    misconception: "Learners describe ionic bonding as 'sharing' electrons, which actually describes covalent bonding — in ionic bonds electrons are transferred outright.",
    analogy: "An ionic bond is handing over a possession for good; a covalent bond is two people jointly holding one.",
    example: "Sodium gives an electron to chlorine to form Na⁺Cl⁻ (ionic). Two hydrogens share a pair to form H₂ (covalent).",
  },
  "cell-structure": {
    definition:
      "The cell is the basic unit of life. Specialised structures called organelles each handle a job: the nucleus stores DNA, mitochondria release energy, and the membrane controls what enters and leaves.",
    keyPoints: [
      "The nucleus holds genetic material and directs the cell.",
      "Mitochondria release energy through respiration.",
      "The cell membrane is selectively permeable; plant cells add a rigid cell wall and chloroplasts.",
    ],
    misconception: "Learners say mitochondria 'make' energy — energy is not created, it is released from glucose and transferred into a usable form (ATP).",
    analogy: "A cell is a factory: the nucleus is the manager's office, mitochondria the power plant, the membrane the security gate.",
    example: "A plant cell has a nucleus, mitochondria, a cell wall, and chloroplasts; an animal cell has the first two but neither of the last.",
  },
  "dna-genetics": {
    definition:
      "DNA is a double helix that stores genetic instructions in sequences of four bases: A, T, C, and G. A gene is a stretch of DNA coding for a trait, and bases pair A–T and C–G.",
    keyPoints: [
      "Base pairing is fixed: A pairs with T, C pairs with G.",
      "A gene is a section of DNA; a chromosome is a packaged DNA molecule.",
      "Offspring inherit one copy of each gene from each parent.",
    ],
    misconception: "Learners use 'gene', 'chromosome', and 'DNA' interchangeably — they describe different scales of the same storage system.",
    analogy: "DNA is a library, chromosomes are the books, and genes are individual recipes inside them.",
    example: "If one DNA strand reads A-T-G-C, the complementary strand must read T-A-C-G.",
  },
  "data-structures": {
    definition:
      "A data structure organises data so specific operations are efficient. Arrays give fast access by position, dictionaries fast lookup by key, and stacks enforce last-in-first-out order.",
    keyPoints: [
      "Arrays/lists: ordered, indexed by position, fast random access.",
      "Dictionaries/hash maps: key → value, near-instant lookup by key.",
      "Stacks are last-in-first-out; queues are first-in-first-out.",
    ],
    misconception: "Learners reach for a list and scan it for every lookup, when a dictionary would answer the same question far faster.",
    analogy: "An array is a numbered row of lockers; a dictionary is a coat check where your ticket takes you straight to your item.",
    example: "Finding a user by ID in a list of 1,000,000 may check every entry; in a dictionary it is one direct lookup.",
  },
  recursion: {
    definition:
      "Recursion is when a function calls itself on a smaller version of the same problem. Every recursive function needs a base case that stops the chain, plus a recursive case that moves toward it.",
    keyPoints: [
      "A base case ends the recursion; without one you get infinite calls.",
      "Each call must shrink the problem toward the base case.",
      "Each pending call takes stack memory until it returns.",
    ],
    misconception: "Learners write the recursive case but omit or never actually reach the base case, causing a stack overflow.",
    analogy: "Recursion is standing between two mirrors — but with a base case that says 'stop after ten reflections'.",
    example: "factorial(n) returns 1 when n is 0 (base case), otherwise n × factorial(n − 1).",
  },
  "big-o-notation": {
    definition:
      "Big-O notation describes how an algorithm's running time or memory grows as the input size grows, ignoring constants and focusing on the dominant term.",
    keyPoints: [
      "O(1) is constant, O(n) linear, O(n²) quadratic, O(log n) logarithmic.",
      "It describes growth rate, not actual seconds on a particular machine.",
      "Only the fastest-growing term matters: O(n² + n) simplifies to O(n²).",
    ],
    misconception: "Learners read Big-O as raw speed — an O(n²) algorithm can beat an O(n log n) one on small inputs; Big-O is about scaling, not stopwatch time.",
    analogy: "Big-O answers 'what happens when the job gets ten times bigger?', not 'how long does today's job take?'.",
    example: "Scanning a list once is O(n). Comparing every pair in a list is O(n²): ten times the data means a hundred times the work.",
  },
  "sql-databases": {
    definition:
      "A relational database stores data in tables of rows and columns. SQL is the language used to ask it questions, most commonly with SELECT ... FROM ... WHERE.",
    keyPoints: [
      "SELECT chooses columns; FROM names the table; WHERE filters rows.",
      "A primary key uniquely identifies each row.",
      "JOIN combines rows from two tables using a shared key.",
    ],
    misconception: "Learners expect WHERE to filter grouped results — that is what HAVING does; WHERE filters individual rows before grouping.",
    analogy: "A table is a spreadsheet, and SQL is a precise way of saying 'show me only these columns, only for rows matching this rule'.",
    example: "SELECT name FROM students WHERE score > 80; returns just the names of students scoring above 80.",
  },
  "how-web-works": {
    definition:
      "Opening a web page sends an HTTP request from your browser (the client) to a server, which returns a response. DNS first translates the human-readable domain name into the server's IP address.",
    keyPoints: [
      "DNS maps a domain name to an IP address.",
      "The browser sends an HTTP request; the server returns a response with a status code.",
      "Status codes signal outcome: 200 OK, 404 not found, 500 server error.",
    ],
    misconception: "Learners imagine a web page being 'stored in the browser' — the browser requests files each visit and assembles the page from the response.",
    analogy: "DNS is a phone book, the request is your call, and the response is the answer shouted back down the line.",
    example: "Typing example.com looks up its IP via DNS, sends GET /, and the server replies 200 OK with the page's HTML.",
  },
  "nimiq-blockchain": {
    definition:
      "Nimiq is a public, proof-of-stake blockchain designed to be reached straight from a web browser. Its nodes agree on one shared history through consensus, and until a client has established consensus it cannot yet trust its own view of balances.",
    keyPoints: [
      "Addresses are human-readable and begin with NQ, printed in nine groups of four.",
      "Validators produce blocks by staking NIM, rather than by spending electricity to mine.",
      "A client checks whether consensus is established before trusting a balance; reading the block height needs no permission.",
    ],
    misconception: "Learners call the chain 'NIM' and the coin 'Nimiq'. It is the other way round: Nimiq is the network, NIM is the coin that moves on it.",
    analogy: "The chain is the railway and NIM is the freight — one is the infrastructure, the other is what travels on it.",
    example: "A wallet that has just opened can report a block number while consensus is still establishing, which is why an app shows 'Waiting for network' instead of a balance it cannot yet prove.",
  },
  "nim-token": {
    definition:
      "NIM is the native coin of the Nimiq blockchain. Amounts are counted internally in Luna, its smallest unit: 1 NIM = 100,000 Luna, so an application converts before it either displays a balance or builds a transaction.",
    keyPoints: [
      "1 NIM = 100,000 Luna, and the provider's transaction methods take Luna, not NIM.",
      "NIM pays transaction fees and is what validators stake to secure the chain.",
      "Show a person an amount in NIM; send the chain an amount in Luna.",
    ],
    misconception: "Learners pass a NIM amount straight into a method that expects Luna, sending one hundred-thousandth of what they meant.",
    analogy: "NIM and Luna are euros and cents, except the split is 100,000 rather than 100.",
    example: "0.5 NIM is 50,000 Luna. Passing 0.5 to sendBasicTransaction would move 0.5 Luna — effectively nothing.",
  },
  "nimiq-pay": {
    definition:
      "Nimiq Pay is a mobile wallet that can also host mini apps: web apps loaded in a WebView that talk to the wallet through injected providers. The mini app never sees a private key, and every payment or signature is confirmed by the person in a native dialog.",
    keyPoints: [
      "Mini apps reach NIM through the Mini App SDK, and EVM chains through window.ethereum.",
      "Account access, signing and transactions each need explicit approval; reading chain state does not.",
      "Keys never leave the wallet — a mini app can request a payment, never authorise one.",
    ],
    misconception: "Learners assume a mini app holds or can spend the user's funds. It can only ask: the wallet and the person decide, and a declined dialog is a normal outcome to handle, not an error.",
    analogy: "A mini app is a market stall inside a bank — it can hand you a bill, but only the teller moves the money, and only once you say yes.",
    example: "NimiqLearn asks Nimiq Pay to send 0.5 NIM for a learning pack. Nimiq Pay shows the recipient and the amount, and nothing moves until the learner approves it.",
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
