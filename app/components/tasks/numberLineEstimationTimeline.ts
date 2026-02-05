// app/components/tasks/numberLineEstimationTimeline.ts

import HtmlSliderResponsePlugin from "@jspsych/plugin-html-slider-response";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import { renderValueHTML } from "@/app/components/renderValue";

// Protocol metrics:
// - PAE = |estimate - true| / (max-min) * 100
// - Directional error = estimate - true (signed, in same scale)
// Here we use 0–100 slider for a 0–1 number line (so estimate_value = slider/100).

type EstimationTrial = {
  id: number;
  stimulus: string; // e.g., "13/20" or "0.35" or "35%"
  trueValue01: number; // true magnitude in [0,1]
  notation: "Fraction" | "Decimal" | "Percentage";
  block?: "Pre-Instruction" | "Post-Instruction";
  difficulty?: "Small" | "Large";
};

type BuildOptions = {
  trials: EstimationTrial[];
  promptTitle?: string;

  // NEW: tag trials as "pre" | "post" | "monster" (or any string you want)
  phase?: string;

  // NEW: optionally hide the intro screen (useful when chaining many sections)
  showIntro?: boolean;
};

// Forces endpoint labels to be visible (you mentioned they were white on your build)
const endpointLabelCSS = `
  <style>
    .jspsych-html-slider-response-container,
    .jspsych-html-slider-response-stimulus {
      color: #111 !important;
    }

    .jspsych-slider-labels {
      color: #111 !important;
      font-weight: 900 !important;
      font-family: "Courier New", monospace !important;
      font-size: 16px !important;
      margin-top: 10px !important;
      letter-spacing: 0.5px !important;
    }

    .jspsych-slider-labels span {
      color: #111 !important;
      opacity: 1 !important;
      text-shadow: 0 1px 0 rgba(255,255,255,0.55) !important;
    }

    .jspsych-content {
      color: #111 !important;
    }

    /* Make the slider track area feel consistent on mobile/tablet */
    input[type="range"] {
      width: min(520px, 100%) !important;
      max-width: 520px !important;
    }
  </style>
`;

export function buildNumberLineEstimationTimeline(options: BuildOptions) {
  const { trials, promptTitle, phase = "number_line_estimation", showIntro = true } =
    options;

  const title = promptTitle ?? "NUMBER LINE ESTIMATION";
  const timeline: any[] = [];

  // Intro screen (BUTTON instead of slider for better UX)
  if (showIntro) {
    timeline.push({
      type: HtmlButtonResponsePlugin,
      stimulus: `
        ${endpointLabelCSS}
        <div style="max-width: 900px; margin: 0 auto; padding: 30px; text-align:center;">
          <h2 style="font-size: 40px; font-weight: 900; color: #16a34a; margin-bottom: 10px; font-family: 'Courier New', monospace;">
            ${title}
          </h2>
          <p style="font-size: 18px; color: #111; margin-bottom: 18px;">
            Place the value on a 0–1 number line.
          </p>
          <p style="font-size: 16px; color: #333;">
            Tap <strong>START</strong> to begin.
          </p>
        </div>
      `,
      choices: ["START"],
      data: { task: "estimation_intro", phase },
    });
  }

  trials.forEach((t, idx) => {
    timeline.push({
      type: HtmlSliderResponsePlugin,
      stimulus: `
        ${endpointLabelCSS}
        <div style="max-width: 900px; margin: 0 auto; padding: 20px; text-align:center;">
          <h2 style="font-size: 34px; font-weight: 900; color: #16a34a; margin-bottom: 18px; font-family: 'Courier New', monospace;">
            PLACE IT ON THE LINE
          </h2>

          <div style="
            margin: 0 auto 18px auto;
            border: 4px solid #111;
            border-radius: 18px;
            background: #fff;
            box-shadow: 8px 8px 0px rgba(0,0,0,0.2);
            width: min(520px, 100%);
            padding: 22px;
            display:flex;
            justify-content:center;
            align-items:center;
          ">
            ${renderValueHTML(t.stimulus)}
          </div>

          <p style="font-size: 16px; color: #666; margin-top: 10px;">
            Item ${idx + 1} / ${trials.length}
          </p>
        </div>
      `,
      labels: ["0", "1"],
      min: 0,
      max: 100,
      start: 50,
      require_movement: true,
      button_label: "SUBMIT",
      data: {
        task: "number_line_estimation",
        phase,

        trial_id: t.id,
        stimulus: t.stimulus,
        notation: t.notation,
        block: t.block ?? null,
        difficulty: t.difficulty ?? null,
        true_value_01: t.trueValue01,
      },
      on_finish: (data: any) => {
        // Slider response is 0..100
        const estimate01 = Number(data.response) / 100;
        const true01 = Number(data.true_value_01);

        // PAE for 0–1 line (range length = 1)
        const pae = Math.abs(estimate01 - true01) * 100;

        // Signed directional error (estimate - true)
        const directional = estimate01 - true01;

        data.estimate_value_01 = estimate01;
        data.pae = pae;
        data.directional_error = directional;
      },
    });
  });

  return timeline;
}
