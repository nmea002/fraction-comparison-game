// app/data/protocolStimuli.ts

// Protocol stimuli derived from your uploaded CSV: Problems_ Cross-Notation.csv
// This keeps the CSV content compact (8 base pairs) and generates:
// - Cross-notation comparisons (6 per base) with WNB metadata from CSV
// - Within-notation comparisons (3 per base) derived from the same values
// - Estimation trials (both values x 3 notations per base)

export type BlockTag = 'Pre-Instruction' | 'Post-Instruction' | 'Custom';
export type DistanceTag = 'Small' | 'Large' | 'Medium' | string;
export type Side = 'left' | 'right';
export type Notation = 'F' | 'D' | 'P';

export type ValueReps = { value: number; F: string; D: string; P: string };

export type BasePairStim = {
  base: string;
  block: BlockTag;
  distance: DistanceTag;
  larger: ValueReps;
  smaller: ValueReps;
  // Metadata keyed by the original CSV relation label
  relationMeta: Record<string, { problemNumber: number; wnb: boolean; decimalDigits: number | null }>;
};

export type ComparisonTrial = {
  id: number;
  block: BlockTag;
  distance: DistanceTag;
  relation: string;
  left: string;
  right: string;
  leftVal: number;
  rightVal: number;
  correctSide: Side;
  meta?: {
    wnbConsistent?: boolean;
    decimalDigits?: number | null;
    source?: 'csv-cross' | 'derived-within' | 'custom';
  };
};

export type EstimationTrial = {
  id: number;
  block: BlockTag;
  distance: DistanceTag;
  notation: 'Fraction' | 'Decimal' | 'Percentage';
  stimulus: string;
  value: number;
  meta?: { source?: 'derived-from-csv' };
};

// IMPORTANT: Your CSV always orders the larger value on the LEFT.
// We MUST randomize left/right before showing trials, otherwise participants can always press F.
export function randomizeSides(trial: ComparisonTrial, rng: () => number = Math.random): ComparisonTrial {
  if (rng() < 0.5) return trial;
  return {
    ...trial,
    left: trial.right,
    right: trial.left,
    leftVal: trial.rightVal,
    rightVal: trial.leftVal,
    correctSide: trial.correctSide === 'left' ? 'right' : 'left',
  };
}

export function correctKeyFromSide(side: Side): 'f' | 'j' {
  return side === 'left' ? 'f' : 'j';
}

export const BASE_PAIRS: BasePairStim[] = [
  {
    base: "0.55 vs 0.40",
    block: "Post-Instruction",
    distance: "Small",
    larger: {
      value: 0.55,
      F: "11/20",
      D: "0.55",
      P: "55%",
    },
    smaller: {
      value: 0.4,
      F: "2/5",
      D: "0.40",
      P: "40%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 67, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 68, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 69, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 70, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 71, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 72, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.55 vs 0.48",
    block: "Post-Instruction",
    distance: "Small",
    larger: {
      value: 0.55,
      F: "11/20",
      D: "0.55",
      P: "55%",
    },
    smaller: {
      value: 0.48,
      F: "12/25",
      D: "0.48",
      P: "48%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 61, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 62, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 63, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 64, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 65, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 66, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.75 vs 0.45",
    block: "Post-Instruction",
    distance: "Large",
    larger: {
      value: 0.75,
      F: "3/4",
      D: "0.75",
      P: "75%",
    },
    smaller: {
      value: 0.45,
      F: "9/20",
      D: "0.45",
      P: "45%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 49, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 50, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 51, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 52, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 53, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 54, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.80 vs 0.40",
    block: "Post-Instruction",
    distance: "Large",
    larger: {
      value: 0.8,
      F: "4/5",
      D: "0.80",
      P: "80%",
    },
    smaller: {
      value: 0.4,
      F: "2/5",
      D: "0.40",
      P: "40%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 55, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 56, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 57, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 58, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 59, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 60, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.52 vs 0.40",
    block: "Pre-Instruction",
    distance: "Small",
    larger: {
      value: 0.52,
      F: "13/25",
      D: "0.52",
      P: "52%",
    },
    smaller: {
      value: 0.4,
      F: "2/5",
      D: "0.40",
      P: "40%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 19, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 20, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 21, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 22, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 23, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 24, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.56 vs 0.48",
    block: "Pre-Instruction",
    distance: "Small",
    larger: {
      value: 0.56,
      F: "14/25",
      D: "0.56",
      P: "56%",
    },
    smaller: {
      value: 0.48,
      F: "12/25",
      D: "0.48",
      P: "48%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 13, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 14, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 15, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 16, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 17, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 18, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.65 vs 0.35",
    block: "Pre-Instruction",
    distance: "Large",
    larger: {
      value: 0.65,
      F: "13/20",
      D: "0.65",
      P: "65%",
    },
    smaller: {
      value: 0.35,
      F: "7/20",
      D: "0.35",
      P: "35%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 1, wnb: false, decimalDigits: 2 },
      "Fraction > Percentage": { problemNumber: 2, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 3, wnb: true, decimalDigits: 2 },
      "Decimal > Percentage": { problemNumber: 4, wnb: true, decimalDigits: 2 },
      "Percentage > Fraction": { problemNumber: 5, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 6, wnb: true, decimalDigits: 2 },
    },
  },
  {
    base: "0.70 vs 0.30",
    block: "Pre-Instruction",
    distance: "Large",
    larger: {
      value: 0.7,
      F: "7/10",
      D: "0.70",
      P: "70%",
    },
    smaller: {
      value: 0.3,
      F: "3/10",
      D: "0.30",
      P: "30%",
    },
    relationMeta: {
      "Fraction > Decimal": { problemNumber: 7, wnb: false, decimalDigits: 1 },
      "Fraction > Percentage": { problemNumber: 8, wnb: false, decimalDigits: null },
      "Decimal > Fraction": { problemNumber: 9, wnb: true, decimalDigits: 1 },
      "Decimal > Percentage": { problemNumber: 10, wnb: true, decimalDigits: 1 },
      "Percentage > Fraction": { problemNumber: 11, wnb: true, decimalDigits: null },
      "Percentage > Decimal": { problemNumber: 12, wnb: true, decimalDigits: 1 },
    },
  },
];

function notationLabel(n: Notation): 'Fraction' | 'Decimal' | 'Percentage' {
  if (n === 'F') return 'Fraction';
  if (n === 'D') return 'Decimal';
  return 'Percentage';
}

const COMPARISON_RAW_PAIRS: Array<{ left: string; right: string }> = [
  { left: "3/8", right: "2/5" },
  { left: "3/8", right: "40%" },
  { left: "38%", right: "2/5" },
  { left: "38%", right: "40%" },
  { left: ".38", right: ".4" },
  { left: ".40", right: "38%" },
  { left: "40%", right: ".38" },
  { left: "2/5", right: ".38" },
  { left: ".4", right: "3/8" },
  { left: "5/8", right: "4/5" },
  { left: "5/8", right: "80%" },
  { left: "63%", right: "4/5" },
  { left: "63%", right: "80%" },
  { left: ".63", right: ".8" },
  { left: "63%", right: ".8" },
  { left: ".6", right: "80%" },
  { left: ".6", right: "4/5" },
  { left: "5/8", right: ".8" },
];

function parseStimulusValue(raw: string): number {
  const value = raw.trim();
  if (value.includes("/")) {
    const [n, d] = value.split("/").map((v) => Number(v.trim()));
    return d === 0 ? 0 : n / d;
  }
  if (value.endsWith("%")) {
    const pct = Number(value.replace("%", "").trim());
    return pct / 100;
  }
  return Number(value);
}

export function buildComparisonTrials(): ComparisonTrial[] {
  let id = 1;
  return COMPARISON_RAW_PAIRS.map(({ left, right }) => {
    const leftVal = parseStimulusValue(left);
    const rightVal = parseStimulusValue(right);
    const correctSide: Side = leftVal >= rightVal ? "left" : "right";
    return {
      id: id++,
      block: "Custom",
      distance: "Custom",
      relation: "Custom",
      left,
      right,
      leftVal,
      rightVal,
      correctSide,
      meta: { source: "custom" },
    };
  });
}

export function buildEstimationTrials(): EstimationTrial[] {
  const trials: EstimationTrial[] = [];
  let id = 10000;

  for (const bp of BASE_PAIRS) {
    const values: Array<{ reps: ValueReps }> = [{ reps: bp.larger }, { reps: bp.smaller }];
    for (const v of values) {
      for (const n of ['F', 'D', 'P'] as Notation[]) {
        trials.push({
          id: id++,
          block: bp.block,
          distance: bp.distance,
          notation: notationLabel(n),
          stimulus: v.reps[n],
          value: v.reps.value,
          meta: { source: 'derived-from-csv' },
        });
      }
    }
  }

  return trials;
}

// Defaults (you can use these immediately in your jsPsych builder later)
export const COMPARISON_TRIALS: ComparisonTrial[] = buildComparisonTrials();
export const ESTIMATION_TRIALS: EstimationTrial[] = buildEstimationTrials();

// Note on length:
// - COMPARISON_TRIALS uses the custom list above (18 pairs)
// - ESTIMATION_TRIALS still derives from BASE_PAIRS (48 total)
