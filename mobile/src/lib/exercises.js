// Exercise catalogue (same ids as the server) with animation keyframes for <ExerciseFigure>.
// Poses are joint positions on a 100×100 canvas (ground at y≈90). The figure loops through the poses.
// Joints: head, neck, hip; eL/hL = far elbow/hand, eR/hR = near elbow/hand; kL/fL, kR/fR = knees/feet.

const stand = { head: [48, 16], neck: [48, 26], hip: [48, 52], eL: [46, 39], hL: [46, 52], eR: [50, 39], hR: [50, 52], kL: [47, 71], fL: [46, 90], kR: [50, 71], fR: [51, 90] };
const plankHigh = { head: [80, 50], neck: [72, 54], hip: [44, 62], eL: [72, 70], hL: [72, 88], eR: [73, 70], hR: [73, 88], kL: [29, 75], fL: [14, 88], kR: [30, 75], fR: [15, 88] };
const frontStand = { head: [50, 16], neck: [50, 27], hip: [50, 54], eL: [43, 40], hL: [40, 52], eR: [57, 40], hR: [60, 52], kL: [47, 72], fL: [46, 90], kR: [53, 72], fR: [54, 90] };

export const EXERCISES = [
  {
    id: "jumping_jacks", name: "Jumping jacks", focus: "cardio", tone: "orange", seconds: 30, tempo: 900,
    tips: ["Land softly on the balls of your feet", "Keep your core tight", "Arms fully overhead each rep"],
    poses: [frontStand, { ...frontStand, eL: [38, 20], hL: [34, 8], eR: [62, 20], hR: [66, 8], kL: [41, 72], fL: [33, 90], kR: [59, 72], fR: [67, 90] }]
  },
  {
    id: "high_knees", name: "High knees", focus: "cardio", tone: "orange", seconds: 30, tempo: 700,
    tips: ["Drive knees to hip height", "Pump your arms", "Stay light and quick"],
    poses: [
      { ...frontStand, kR: [56, 58], fR: [56, 74], eL: [43, 38], hL: [45, 29], eR: [58, 42], hR: [60, 53] },
      { ...frontStand, kL: [44, 58], fL: [44, 74], eR: [57, 38], hR: [55, 29], eL: [42, 42], hL: [40, 53] }
    ]
  },
  {
    id: "mountain_climber", name: "Mountain climbers", focus: "cardio", tone: "orange", seconds: 30, tempo: 650,
    tips: ["Hands under shoulders", "Keep hips low", "Drive knees towards chest"],
    poses: [
      { ...plankHigh, kR: [58, 72], fR: [50, 86], kL: [29, 75], fL: [14, 88] },
      { ...plankHigh, kL: [58, 72], fL: [50, 86], kR: [30, 75], fR: [15, 88] }
    ]
  },
  {
    id: "burpee", name: "Burpees", focus: "cardio", tone: "red", reps: 8, tempo: 2600,
    tips: ["Hands down, jump feet back", "Chest to floor if you can", "Jump up with arms overhead"],
    poses: [
      { ...stand, head: [48, 10], neck: [48, 20], hip: [48, 46], eL: [44, 11], hL: [42, 1], eR: [52, 11], hR: [54, 1], kL: [47, 64], fL: [46, 82], kR: [50, 64], fR: [51, 82] },
      { head: [60, 50], neck: [55, 56], hip: [40, 66], eL: [60, 72], hL: [64, 88], eR: [61, 72], hR: [65, 88], kL: [52, 72], fL: [44, 90], kR: [53, 72], fR: [45, 90] },
      plankHigh,
      { head: [60, 50], neck: [55, 56], hip: [40, 66], eL: [60, 72], hL: [64, 88], eR: [61, 72], hR: [65, 88], kL: [52, 72], fL: [44, 90], kR: [53, 72], fR: [45, 90] }
    ]
  },
  {
    id: "squat", name: "Squats", focus: "legs", tone: "green", reps: 15, tempo: 1800,
    tips: ["Feet shoulder-width apart", "Sit back like into a chair", "Knees follow your toes"],
    poses: [
      { ...stand, eL: [57, 33], hL: [67, 33], eR: [58, 32], hR: [68, 32] },
      { head: [50, 32], neck: [46, 42], hip: [34, 64], eL: [57, 45], hL: [69, 45], eR: [58, 44], hR: [70, 44], kL: [55, 67], fL: [49, 90], kR: [56, 66], fR: [51, 90] }
    ]
  },
  {
    id: "lunge", name: "Alternating lunges", focus: "legs", tone: "green", reps: 12, tempo: 2000,
    tips: ["Step forward and drop the back knee", "Front knee over the ankle", "Push back to standing"],
    poses: [stand, { head: [48, 28], neck: [48, 38], hip: [48, 64], eL: [47, 50], hL: [47, 62], eR: [49, 50], hR: [50, 62], kL: [40, 84], fL: [28, 89], kR: [62, 74], fR: [64, 90] }]
  },
  {
    id: "glute_bridge", name: "Glute bridges", focus: "legs", tone: "green", reps: 15, tempo: 1800,
    tips: ["Feet flat, knees bent", "Squeeze glutes at the top", "Lower slowly"],
    poses: [
      { head: [18, 84], neck: [27, 85], hip: [52, 87], eL: [38, 88], hL: [50, 90], eR: [39, 88], hR: [51, 90], kL: [64, 72], fL: [72, 90], kR: [65, 72], fR: [73, 90] },
      { head: [18, 84], neck: [28, 82], hip: [52, 70], eL: [38, 88], hL: [50, 90], eR: [39, 88], hR: [51, 90], kL: [64, 66], fL: [72, 90], kR: [65, 66], fR: [73, 90] }
    ]
  },
  {
    id: "wall_sit", name: "Wall sit", focus: "legs", tone: "green", seconds: 30, tempo: 1600, prop: "wall",
    tips: ["Back flat against the wall", "Thighs parallel to the floor", "Breathe steadily"],
    poses: [
      { head: [33, 26], neck: [33, 36], hip: [33, 62], eL: [38, 50], hL: [46, 57], eR: [39, 50], hR: [47, 57], kL: [52, 62], fL: [52, 90], kR: [53, 62], fR: [53, 90] },
      { head: [33, 25], neck: [33, 35], hip: [33, 61], eL: [38, 49], hL: [46, 56], eR: [39, 49], hR: [47, 56], kL: [52, 62], fL: [52, 90], kR: [53, 62], fR: [53, 90] }
    ]
  },
  {
    id: "pushup", name: "Push-ups", focus: "upper", tone: "blue", reps: 10, tempo: 1800,
    tips: ["Body in one straight line", "Elbows at about 45°", "Chest close to the floor"],
    poses: [plankHigh, { head: [80, 72], neck: [72, 76], hip: [44, 77], eL: [62, 74], hL: [72, 88], eR: [63, 74], hR: [73, 88], kL: [29, 83], fL: [14, 88], kR: [30, 83], fR: [15, 88] }]
  },
  {
    id: "knee_pushup", name: "Knee push-ups", focus: "upper", tone: "blue", reps: 10, tempo: 1800,
    tips: ["Knees on the floor", "Hips in line with shoulders", "Lower with control"],
    poses: [
      { head: [80, 52], neck: [72, 56], hip: [44, 68], eL: [72, 72], hL: [72, 88], eR: [73, 72], hR: [73, 88], kL: [28, 86], fL: [16, 74], kR: [29, 86], fR: [17, 74] },
      { head: [80, 74], neck: [72, 78], hip: [44, 79], eL: [62, 76], hL: [72, 88], eR: [63, 76], hR: [73, 88], kL: [28, 86], fL: [16, 74], kR: [29, 86], fR: [17, 74] }
    ]
  },
  {
    id: "triceps_dip", name: "Chair dips", focus: "upper", tone: "blue", reps: 10, tempo: 1800, prop: "bench",
    tips: ["Hands on the chair edge", "Lower until elbows reach 90°", "Keep shoulders down"],
    poses: [
      { head: [34, 28], neck: [34, 38], hip: [35, 62], eL: [29, 50], hL: [26, 62], eR: [30, 50], hR: [27, 62], kL: [57, 62], fL: [60, 90], kR: [58, 62], fR: [61, 90] },
      { head: [35, 40], neck: [35, 50], hip: [36, 74], eL: [20, 52], hL: [26, 62], eR: [21, 52], hR: [27, 62], kL: [57, 70], fL: [60, 90], kR: [58, 70], fR: [61, 90] }
    ]
  },
  {
    id: "superman", name: "Superman hold", focus: "upper", tone: "indigo", reps: 12, tempo: 2000,
    tips: ["Lie face down", "Lift arms, chest and legs", "Hold for a breath at the top"],
    poses: [
      { head: [78, 84], neck: [70, 86], hip: [42, 88], eL: [82, 85], hL: [92, 84], eR: [83, 85], hR: [93, 84], kL: [26, 88], fL: [10, 88], kR: [27, 88], fR: [11, 88] },
      { head: [80, 76], neck: [70, 80], hip: [42, 88], eL: [82, 74], hL: [92, 70], eR: [83, 74], hR: [93, 70], kL: [26, 86], fL: [10, 80], kR: [27, 86], fR: [11, 80] }
    ]
  },
  {
    id: "plank", name: "Plank", focus: "core", tone: "violet", seconds: 30, tempo: 2400,
    tips: ["Elbows under shoulders", "Squeeze glutes and core", "Don't let hips sag"],
    poses: [
      { head: [80, 62], neck: [72, 66], hip: [44, 70], eL: [72, 88], hL: [84, 88], eR: [73, 88], hR: [85, 88], kL: [29, 79], fL: [14, 88], kR: [30, 79], fR: [15, 88] },
      { head: [80, 63], neck: [72, 67], hip: [44, 72], eL: [72, 88], hL: [84, 88], eR: [73, 88], hR: [85, 88], kL: [29, 80], fL: [14, 88], kR: [30, 80], fR: [15, 88] }
    ]
  },
  {
    id: "side_plank", name: "Side plank", focus: "core", tone: "violet", seconds: 20, tempo: 2400,
    tips: ["Elbow under shoulder", "Lift hips into a straight line", "Reach the top arm up"],
    poses: [
      { head: [78, 54], neck: [70, 60], hip: [44, 72], eL: [70, 74], hL: [70, 88], eR: [70, 48], hR: [70, 36], kL: [29, 80], fL: [14, 88], kR: [30, 79], fR: [15, 87] },
      { head: [78, 52], neck: [70, 58], hip: [44, 68], eL: [70, 74], hL: [70, 88], eR: [72, 44], hR: [73, 30], kL: [29, 78], fL: [14, 88], kR: [30, 77], fR: [15, 87] }
    ]
  },
  {
    id: "crunch", name: "Crunches", focus: "core", tone: "violet", reps: 15, tempo: 1600,
    tips: ["Hands lightly behind your head", "Lift shoulders, not your neck", "Exhale as you curl up"],
    poses: [
      { head: [20, 82], neck: [28, 84], hip: [50, 88], eL: [26, 76], hL: [20, 80], eR: [27, 77], hR: [21, 81], kL: [62, 72], fL: [72, 88], kR: [63, 72], fR: [73, 88] },
      { head: [30, 72], neck: [36, 76], hip: [50, 88], eL: [34, 66], hL: [30, 70], eR: [35, 67], hR: [31, 71], kL: [62, 72], fL: [72, 88], kR: [63, 72], fR: [73, 88] }
    ]
  },
  {
    id: "bicycle_crunch", name: "Bicycle crunches", focus: "core", tone: "violet", reps: 16, tempo: 1400,
    tips: ["Elbow towards opposite knee", "Extend the other leg", "Move with control"],
    poses: [
      { head: [30, 74], neck: [36, 78], hip: [50, 88], eL: [42, 70], hL: [32, 72], eR: [41, 70], hR: [31, 72], kL: [66, 84], fL: [82, 82], kR: [58, 70], fR: [68, 74] },
      { head: [30, 74], neck: [36, 78], hip: [50, 88], eL: [36, 69], hL: [30, 72], eR: [35, 69], hR: [29, 72], kL: [58, 70], fL: [68, 74], kR: [66, 84], fR: [82, 82] }
    ]
  },
  {
    id: "arm_circles", name: "Arm circles", focus: "mobility", tone: "cyan", seconds: 30, tempo: 1200,
    tips: ["Arms straight out to the sides", "Make small, controlled circles", "Switch direction halfway"],
    poses: [
      { ...frontStand, eL: [38, 28], hL: [26, 24], eR: [62, 28], hR: [74, 24] },
      { ...frontStand, eL: [38, 29], hL: [25, 30], eR: [62, 29], hR: [75, 30] },
      { ...frontStand, eL: [38, 31], hL: [27, 36], eR: [62, 31], hR: [73, 36] },
      { ...frontStand, eL: [38, 29], hL: [29, 30], eR: [62, 29], hR: [71, 30] }
    ]
  },
  {
    id: "toe_touch", name: "Standing toe touch", focus: "mobility", tone: "cyan", seconds: 30, tempo: 2600,
    tips: ["Soft knees", "Hinge at the hips", "Reach down slowly, don't bounce"],
    poses: [
      { ...stand, eL: [47, 12], hL: [47, 2], eR: [49, 12], hR: [49, 2] },
      { head: [72, 60], neck: [64, 52], hip: [48, 52], eL: [66, 68], hL: [64, 86], eR: [67, 68], hR: [65, 86], kL: [47, 71], fL: [46, 90], kR: [50, 71], fR: [51, 90] }
    ]
  }
];

export const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const FOCUSES = [
  { id: "full", label: "Full body", icon: "bolt", tone: "violet" },
  { id: "cardio", label: "Cardio", icon: "flame", tone: "orange" },
  { id: "legs", label: "Legs", icon: "dumbbell", tone: "green" },
  { id: "upper", label: "Upper body", icon: "dumbbell", tone: "blue" },
  { id: "core", label: "Core", icon: "target", tone: "indigo" },
  { id: "mobility", label: "Mobility", icon: "stretch", tone: "cyan" }
];

// Ready-made routines (built by the server's planner, or AI when available).
export const ROUTINES = [
  { key: "morning", title: "Morning energizer", minutes: 10, focus: "full", level: "easy", icon: "sunrise", tone: "amber", preview: "jumping_jacks" },
  { key: "core", title: "Core crusher", minutes: 15, focus: "core", level: "medium", icon: "target", tone: "indigo", preview: "bicycle_crunch" },
  { key: "legs", title: "Leg day", minutes: 20, focus: "legs", level: "medium", icon: "dumbbell", tone: "green", preview: "squat" },
  { key: "cardio", title: "Cardio burn", minutes: 20, focus: "cardio", level: "hard", icon: "flame", tone: "orange", preview: "mountain_climber" },
  { key: "upper", title: "Upper body", minutes: 15, focus: "upper", level: "medium", icon: "dumbbell", tone: "blue", preview: "pushup" },
  { key: "stretch", title: "Stretch & reset", minutes: 10, focus: "mobility", level: "easy", icon: "stretch", tone: "cyan", preview: "toe_touch" }
];

export const doseLabel = (b) => (b.seconds ? `${b.seconds} sec` : `${b.reps} reps`);
export const blockSeconds = (b) => (b.seconds ?? (b.reps ?? 10) * 3) + (b.rest_seconds ?? 0);
