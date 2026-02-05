// app/components/JsPsychExperiment.tsx

"use client";

import { useEffect, useRef } from "react";
import { initJsPsych } from "jspsych";
import "jspsych/css/jspsych.css";

import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import HtmlSliderResponsePlugin from "@jspsych/plugin-html-slider-response";
import HtmlSurveyTextPlugin from "@jspsych/plugin-survey-text";
import { getSession, upsertSession, clearSession } from "@/lib/sessionStore";
import { renderValueHTML } from "@/app/components/renderValue";

import { buildConsentAndIdTimeline } from "./tasks/consentAndIdTimeline";
import { buildMagnitudeComparisonTimeline } from "./tasks/magnitudeComparisonTimeline";
import { buildNumberLineEstimationTimeline } from "./tasks/numberLineEstimationTimeline";



type ExperimentProps = {
  onFinish?: (data: any) => void;
};

const JsPsychExperiment: React.FC<ExperimentProps> = ({ onFinish }) => {
  const experimentDivId = "jspsych-target";
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const jsPsych = initJsPsych({
      display_element: experimentDivId,
      on_finish: () => {
        const all = jsPsych.data.get();

        const consentRow = all.filter({ task: "consent" }).values()?.[0];
        const idRow = all.filter({ task: "id_entry" }).values()?.[0];

        const participantId = idRow?.participant_id ?? null;
        const consented = consentRow?.consented ?? null;

        const mean = (arr: number[], decimals = 0) => {
          if (!arr.length) return null;
          const m = arr.reduce((a, b) => a + b, 0) / arr.length;
          return decimals > 0 ? Number(m.toFixed(decimals)) : Math.round(m);
        };

        const summarizeComparison = (phase: "pre" | "post") => {
          const compare = all.filter({ task: "magnitude_compare", phase });

          const total = compare.count();
          const correct = compare.select("correct").values.filter(Boolean).length;

          const rtValues = compare
            .select("rt")
            .values.filter((v: any) => typeof v === "number") as number[];

          return {
            total,
            correct,
            accuracy: total > 0 ? correct / total : null,
            meanRT_ms: mean(rtValues, 0),
          };
        };

        const summarizeEstimation = (phase: "pre" | "post") => {
          const est = all.filter({ task: "number_line_estimation", phase });

          const total = est.count();

          const paeVals = est
            .select("pae")
            .values.filter((v: any) => typeof v === "number") as number[];

          const dirVals = est
            .select("directional_error")
            .values.filter((v: any) => typeof v === "number") as number[];

          return {
            total,
            meanPAE: mean(paeVals, 2),
            meanDirectionalError: mean(dirVals, 4),
          };
        };

        const preCompare = summarizeComparison("pre");
        const postCompare = summarizeComparison("post");

        const preEst = summarizeEstimation("pre");
        const postEst = summarizeEstimation("post");

        const pid = ((window as any).__participantId ?? "").toString().trim();
        const saved = pid ? getSession(pid) : null;
        const resumeFlow = !!(window as any).__resumeFlow;

        const savedPre = saved?.payload?.pre_summary;

        const finalPreCompare = resumeFlow && savedPre?.comparison ? savedPre.comparison : preCompare;
        const finalPreEst = resumeFlow && savedPre?.estimation ? savedPre.estimation : preEst;


        if (onFinish) {
          onFinish({
            raw: all,
            summary: {
              consented,
              participantId,
              pre: { comparison: finalPreCompare, estimation: finalPreEst },

              post: { comparison: postCompare, estimation: postEst },
            },
          });
        }
      },
    });

    // keep this for consent flow
    (window as any).jsPsych = jsPsych;

    // default: assume NEW session unless user chooses Resume
    (window as any).__resumeFlow = false;


    // --- Helpers for checkpoint saving (Pre-test complete) ---
    const mean = (arr: number[], decimals = 0) => {
      if (!arr.length) return null;
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return decimals > 0 ? Number(m.toFixed(decimals)) : Math.round(m);
    };

    const summarizeComparisonFrom = (dataView: any, phase: "pre" | "post") => {
      const compare = dataView.filter({ task: "magnitude_compare", phase });
      const total = compare.count();
      const correct = compare.select("correct").values.filter(Boolean).length;

      const rtValues = compare
        .select("rt")
        .values.filter((v: any) => typeof v === "number") as number[];

      return {
        total,
        correct,
        accuracy: total > 0 ? correct / total : null,
        meanRT_ms: mean(rtValues, 0),
      };
    };

    const summarizeEstimationFrom = (dataView: any, phase: "pre" | "post") => {
      const est = dataView.filter({ task: "number_line_estimation", phase });
      const total = est.count();

      const paeVals = est
        .select("pae")
        .values.filter((v: any) => typeof v === "number") as number[];

      const dirVals = est
        .select("directional_error")
        .values.filter((v: any) => typeof v === "number") as number[];

      return {
        total,
        meanPAE: mean(paeVals, 2),
        meanDirectionalError: mean(dirVals, 4),
      };
    };

    const savePreCheckpoint = () => {
  const allNow = jsPsych.data.get();

  const idRow = allNow.filter({ task: "id_entry" }).values()?.[0];
  const participantId = (idRow?.participant_id ?? "").toString().trim();

  if (!participantId) return; // don't save without ID

  const preSummary = {
    comparison: summarizeComparisonFrom(allNow, "pre"),
    estimation: summarizeEstimationFrom(allNow, "pre"),
  };

  const preRawRows = allNow.values();

  upsertSession(participantId, {
    stage: "PRE_DONE",
    payload: {
      pre_raw: preRawRows,
      pre_summary: preSummary,
    },
  });
};

    const saveMonsterCheckpoint = () => {
  const pid = ((window as any).__participantId ?? "").toString().trim();
  if (!pid) return;

  const existing = getSession(pid);

  upsertSession(pid, {
    stage: "MONSTER_DONE",
    payload: {
      ...(existing?.payload ?? {}),
      monster_done: true,
    },
  });
};

    const positionMonster = (
      slider: HTMLInputElement,
      img: HTMLImageElement
    ) => {
      const container =
        (slider.closest(".jspsych-html-slider-response-container") as HTMLElement | null) ||
        (slider.closest(".jspsych-content") as HTMLElement | null) ||
        (slider.parentElement as HTMLElement | null);
      if (!container) return;
      if (img.parentElement !== container) {
        container.prepend(img);
      }
      container.style.position = "relative";
      container.style.paddingTop = "54px";
      container.style.overflow = "visible";
      const containerRect = container.getBoundingClientRect();
      const rect = slider.getBoundingClientRect();
      const min = Number(slider.min ?? "0");
      const max = Number(slider.max ?? "100");
      const val = Number(slider.value);
      const ratio = max === min ? 0 : (val - min) / (max - min);
      const left = rect.left - containerRect.left + ratio * rect.width;
      const top = Math.max(0, rect.top - containerRect.top - 40);

      img.style.position = "absolute";
      img.style.display = "block";
      img.style.zIndex = "10";
      img.style.left = `${left}px`;
      img.style.top = `${top}px`;
      img.style.width = "53px";
      img.style.height = "auto";
      img.style.pointerEvents = "none";
      img.style.transform = "translateX(-50%)";
      img.style.visibility = "visible";
    };



    // number line trials (custom 12-item set)
    const ESTIMATION_TRIALS_DEMO = [
      { id: 1, stimulus: "20/100", trueValue01: 0.2, notation: "Fraction" as const },
      { id: 2, stimulus: "40/100", trueValue01: 0.4, notation: "Fraction" as const },
      { id: 3, stimulus: "80/100", trueValue01: 0.8, notation: "Fraction" as const },
      { id: 4, stimulus: "2/9", trueValue01: 2 / 9, notation: "Fraction" as const },
      { id: 5, stimulus: "3/7", trueValue01: 3 / 7, notation: "Fraction" as const },
      { id: 6, stimulus: "7/8", trueValue01: 0.875, notation: "Fraction" as const },
      { id: 7, stimulus: "0.20", trueValue01: 0.2, notation: "Decimal" as const },
      { id: 8, stimulus: "0.80", trueValue01: 0.8, notation: "Decimal" as const },
      { id: 9, stimulus: "0.22", trueValue01: 0.22, notation: "Decimal" as const },
      { id: 10, stimulus: "0.88", trueValue01: 0.88, notation: "Decimal" as const },
      { id: 11, stimulus: "0.2", trueValue01: 0.2, notation: "Decimal" as const },
      { id: 12, stimulus: "0.8", trueValue01: 0.8, notation: "Decimal" as const },
    ];

    const createRng = (seedInput?: string | number): (() => number) => {
      if (seedInput === undefined || seedInput === null) return Math.random;
      const seedStr = String(seedInput);
      let h = 2166136261;
      for (let i = 0; i < seedStr.length; i += 1) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      let state = h >>> 0;
      return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const shuffleWithSeed = <T,>(arr: T[], seed: string) => {
      const rng = createRng(seed);
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };

    const preEstTrials = shuffleWithSeed(ESTIMATION_TRIALS_DEMO, "pre-nl-v1");
    const postEstTrials = shuffleWithSeed(ESTIMATION_TRIALS_DEMO, "post-nl-v1");

    const ARITHMETIC_TRIALS = [
      {
        id: 1,
        a: "5/6",
        b: "2/4",
        choices: ["7/10", "1/3", "1 1/4"],
      },
      {
        id: 2,
        a: "3/4",
        b: "1/10",
        choices: ["4/14", "1 1/4", "9/10"],
      },
      {
        id: 3,
        a: "1/5",
        b: "1/2",
        choices: ["2/7", "1/3", "3/4"],
      },
      {
        id: 4,
        a: "3/5",
        b: "8/9",
        choices: ["11/45", "2", "1 1/2"],
      },
      {
        id: 5,
        a: "2/9",
        b: "3/5",
        choices: ["5/45", "4/18", "4/5"],
      },
      {
        id: 6,
        a: "3/4",
        b: "2/10",
        choices: ["5/40", "1 1/2", "1"],
      },
    ];

    const parseArithmeticValue = (raw: string): number => {
      const value = raw.trim();
      const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
      if (mixed) {
        const whole = Number(mixed[1]);
        const n = Number(mixed[2]);
        const d = Number(mixed[3]);
        return d === 0 ? whole : whole + n / d;
      }
      if (value.includes("/")) {
        const [n, d] = value.split("/").map((v) => Number(v.trim()));
        return d === 0 ? 0 : n / d;
      }
      return Number(value);
    };

    const buildArithmeticTimeline = (
      trials: typeof ARITHMETIC_TRIALS,
      phase: "pre" | "post",
      orderSeed: string
    ) => {
      const ordered = shuffleWithSeed(trials, orderSeed);
      return ordered.map((t, idx) => {
        const total = parseArithmeticValue(t.a) + parseArithmeticValue(t.b);
        const choiceVals = t.choices.map(parseArithmeticValue);
        let bestIdx = 0;
        let bestDiff = Math.abs(choiceVals[0] - total);
        for (let i = 1; i < choiceVals.length; i += 1) {
          const diff = Math.abs(choiceVals[i] - total);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }

        let timerId: number | null = null;
        return {
          type: HtmlButtonResponsePlugin,
          stimulus: `
            <style>
              .arith-title { font-size: 22px; font-weight: 900; color: #111; margin-bottom: 6px; text-align:center; }
              .arith-problem { font-size: 34px; font-weight: 900; color: #111; margin: 10px 0 16px; text-align:center; }
              .arith-timer { font-size: 16px; color: #444; text-align:center; margin-bottom: 6px; }
              .arith-progress { font-size: 14px; color: #777; text-align:center; margin-top: 6px; }
            </style>
            <div style="max-width: 920px; margin: 0 auto; padding: 24px; text-align:center;">
              <div class="arith-title">ARITHMETIC ESTIMATION</div>
              <div class="arith-timer">Time left: <span id="arith-timer">10</span>s</div>
              <div class="arith-problem">${renderValueHTML(t.a)} + ${renderValueHTML(t.b)}</div>
              <div class="arith-progress">Item ${idx + 1} / ${ordered.length}</div>
            </div>
          `,
          choices: t.choices.map((c) => {
            const raw = c.trim();
            const mixed = raw.match(/^(\d+)\s+(\d+\/\d+)$/);
            if (mixed) {
              const whole = mixed[1];
              const frac = mixed[2];
              return `
                <span style="display:inline-flex; align-items:center; gap:8px;">
                  <span style="font-family:'Courier New', monospace; font-weight:900; font-size:40px; color:#111;">
                    ${whole}
                  </span>
                  ${renderValueHTML(frac)}
                </span>
              `;
            }
            return renderValueHTML(raw);
          }),
          trial_duration: 10000,
          response_ends_trial: true,
          on_load: () => {
            const el = document.getElementById("arith-timer");
            let remaining = 10;
            timerId = window.setInterval(() => {
              remaining -= 1;
              if (el) el.textContent = String(Math.max(remaining, 0));
              if (remaining <= 0 && timerId) {
                window.clearInterval(timerId);
                timerId = null;
              }
            }, 1000);
          },
          on_finish: (data: any) => {
            if (timerId) window.clearInterval(timerId);
            data.task = "arithmetic_estimation";
            data.phase = phase;
            data.trial_id = t.id;
            data.problem = `${t.a} + ${t.b}`;
            data.choices = t.choices;
            data.choice_values = choiceVals;
            data.target_value = total;
            data.correct_choice_index = bestIdx;
            data.chosen_index = data.response ?? null;
            data.correct = data.response === bestIdx;
            data.timeout = data.response == null;
          },
        };
      });
    };

    const preArithmetic = buildArithmeticTimeline(ARITHMETIC_TRIALS, "pre", "pre-arith-v1");
    const postArithmetic = buildArithmeticTimeline(ARITHMETIC_TRIALS, "post", "post-arith-v1");

    const PCK_IMAGE_PATHS = {
      q4A: "/pck/Screenshot%202026-02-04%20110047.png",
      q4B: "/pck/Screenshot%202026-02-04%20105938.png",
      q4C: "/pck/Screenshot%202026-02-04%20110053.png",
      q4D: "/pck/Screenshot%202026-02-04%20110056.png",
      q7: "/pck/Screenshot%202026-02-04%20110634.png",
    };

    const pckBaseCSS = `
      <style>
        .pck-wrap { max-width: 920px; margin: 0 auto; padding: 24px; }
        .pck-title {
          font-size: 24px;
          font-weight: 900;
          color: #111;
          text-align: center;
          font-family: "Courier New", monospace;
          margin-bottom: 6px;
        }
        .pck-q { font-size: 18px; color: #111; margin: 12px 0 12px; }
        .pck-sub { font-size: 15px; color: #444; margin-bottom: 8px; }
        .pck-choices { display: flex; flex-direction: column; gap: 10px; }
        .pck-choice { display: flex; align-items: flex-start; gap: 10px; font-size: 16px; color: #111; }
        .pck-choice input { margin-top: 4px; }
        .pck-explain { font-weight: 900; margin-bottom: 6px; color: #6b7280; }
        .pck-textarea {
          width: min(760px, 100%);
          min-height: 120px;
          border: 2px solid #111;
          border-radius: 12px;
          padding: 10px;
          background: #fff;
          color: #111;
          font-size: 16px;
        }
        .pck-select {
          width: min(520px, 100%);
          border: 2px solid #111;
          border-radius: 10px;
          padding: 8px 10px;
          background: #fff;
          color: #111;
          font-size: 15px;
        }
        .pck-actions { margin-top: 16px; text-align: center; }
        .pck-btn {
          font-family: "Courier New", monospace;
          font-weight: 900;
          border: 3px solid #111;
          border-radius: 14px;
          padding: 10px 16px;
          cursor: pointer;
          background: #ffffff;
          color: #111;
        }
        .pck-error {
          color: #b91c1c;
          font-weight: 700;
          margin-top: 8px;
          display: none;
          text-align: center;
        }
        .pck-list { margin: 8px 0 12px 16px; color: #111; }
        .pck-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
        .pck-dnd { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .pck-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 2px solid #111;
          border-radius: 12px;
          padding: 12px 14px;
          background: #fff;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.15);
          cursor: grab;
        }
        .pck-card.dragging { opacity: 0.6; }
        .pck-card .pck-text { font-size: 16px; font-weight: 700; color: #111; }
        .pck-handle { font-size: 18px; margin-right: 8px; }
        .pck-move { display: flex; gap: 6px; }
        .pck-move button {
          border: 2px solid #111;
          border-radius: 8px;
          background: #f3f4f6;
          padding: 2px 6px;
          cursor: pointer;
          font-weight: 900;
        }
        .pck-move button:active { transform: translateY(1px); }
        .pck-image {
          width: 100%;
          max-width: 240px;
          border: 2px solid #111;
          border-radius: 10px;
          display: block;
          margin-top: 6px;
        }
        .pck-image-wide {
          width: 100%;
          max-width: 420px;
          border: 2px solid #111;
          border-radius: 10px;
          display: block;
          margin: 10px 0;
        }
        .pck-equation { font-size: 20px; font-weight: 900; color: #111; margin: 8px 0 6px; }
        @media (max-width: 480px) {
          .pck-title { font-size: 20px; }
          .pck-q { font-size: 16px; }
        }
      </style>
    `;

    const buildPckTimeline = (phase: "pre" | "post") => {
      const q1Choices = [
        { id: "A", text: "2/5 vs. 25%" },
        { id: "B", text: "40% vs. 1/4" },
        { id: "C", text: "40% vs. 25%" },
        { id: "D", text: "2/5 vs. 1/4" },
      ];

      const q1 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              1) Ms. Hernandez has been helping her students learn about the magnitude of rational numbers.
              She is trying to devise an assignment that has a mix of easier and more challenging problems.
              Sort these problems based on most challenging to least challenging:
            </div>
            <div class="pck-sub">Drag to reorder from most challenging (top) to least challenging (bottom).</div>
            <form id="pck-q1-form">
              <ul id="pck-q1-list" class="pck-dnd">
                ${q1Choices
                  .map(
                    (c) => `
                      <li class="pck-card" draggable="true" data-id="${c.id}">
                        <div class="pck-text">
                          <span class="pck-handle">::</span>
                          <strong>${c.id})</strong> ${c.text}
                        </div>
                        <div class="pck-move">
                          <button type="button" data-move="up" aria-label="Move up">^</button>
                          <button type="button" data-move="down" aria-label="Move down">v</button>
                        </div>
                      </li>
                    `
                  )
                  .join("")}
              </ul>
              <input type="hidden" id="pck-q1-order" name="order" value="A,B,C,D" />

              <div style="margin-top: 14px;">
                <div class="pck-explain">Explain: _____ (Open response box)</div>
                <textarea class="pck-textarea" name="explain" aria-label="Explain" required></textarea>
              </div>

              <div id="pck-q1-error" class="pck-error">Please use each option exactly once.</div>
              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q1-form") as HTMLFormElement | null;
          const errorEl = document.getElementById("pck-q1-error") as HTMLElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const fd = new FormData(form);
            const orderRaw = String(fd.get("order") ?? "").trim();
            const ranks = orderRaw.split(",").map((s) => s.trim()).filter(Boolean);
            const unique = new Set(ranks);
            if (ranks.length !== 4 || unique.size !== 4) {
              if (errorEl) errorEl.style.display = "block";
              return;
            }
            if (errorEl) errorEl.style.display = "none";
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q1",
              rank_most: ranks[0],
              rank_second: ranks[1],
              rank_third: ranks[2],
              rank_least: ranks[3],
              explain: String(fd.get("explain") ?? "").trim(),
            });
          });
          const list = document.getElementById("pck-q1-list") as HTMLElement | null;
          const orderInput = document.getElementById("pck-q1-order") as HTMLInputElement | null;
          if (!list || !orderInput) return;
          let dragEl: HTMLElement | null = null;

          const updateOrder = () => {
            const ids = Array.from(list.querySelectorAll(".pck-card"))
              .map((el) => (el as HTMLElement).dataset.id ?? "")
              .filter(Boolean);
            orderInput.value = ids.join(",");
          };

          list.querySelectorAll(".pck-card").forEach((item) => {
            item.addEventListener("dragstart", (e) => {
              dragEl = item as HTMLElement;
              dragEl.classList.add("dragging");
              const dt = (e as DragEvent).dataTransfer;
              if (dt) dt.effectAllowed = "move";
            });
            item.addEventListener("dragend", () => {
              if (dragEl) dragEl.classList.remove("dragging");
              dragEl = null;
              updateOrder();
            });
          });

          list.addEventListener("dragover", (e) => {
            e.preventDefault();
            const target = (e.target as HTMLElement).closest(".pck-card") as HTMLElement | null;
            if (!target || !dragEl || target === dragEl) return;
            const rect = target.getBoundingClientRect();
            const next = (e as DragEvent).clientY > rect.top + rect.height / 2;
            list.insertBefore(dragEl, next ? target.nextSibling : target);
          });

          list.addEventListener("click", (e) => {
            const btn = (e.target as HTMLElement).closest("button[data-move]") as HTMLButtonElement | null;
            if (!btn) return;
            const card = (e.target as HTMLElement).closest(".pck-card") as HTMLElement | null;
            if (!card) return;
            const dir = btn.getAttribute("data-move");
            if (dir === "up" && card.previousElementSibling) {
              list.insertBefore(card, card.previousElementSibling);
            } else if (dir === "down" && card.nextElementSibling) {
              list.insertBefore(card.nextElementSibling, card);
            }
            updateOrder();
          });

          updateOrder();
        },
      };

      const q2 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              2) Mr. Fitzgerald has been helping his students learn how to compare decimals.
              He is trying to devise an assignment that shows him whether his students know how to correctly put
              a series of decimals in order. Which of the following sets of numbers will best suit that purpose?
            </div>
            <form id="pck-q2-form">
              <div class="pck-choices">
                <label class="pck-choice">
                  <input type="radio" name="choice" value="A" required />
                  <span><strong>A)</strong> .5, 7, .01, 11.4</span>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="B" required />
                  <span><strong>B)</strong> .60, 2.53, 3.14, .45</span>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="C" required />
                  <span><strong>C)</strong> .6, 4.25, .565, 2.5</span>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="D" required />
                  <span><strong>D)</strong> Any of these would work well for the purpose. They all require the students to read and interpret decimals.</span>
                </label>
              </div>

              <div style="margin-top: 14px;">
                <div class="pck-explain">Explain: _____ (Open response box)</div>
                <textarea class="pck-textarea" name="explain" aria-label="Explain" required></textarea>
              </div>

              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q2-form") as HTMLFormElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const fd = new FormData(form);
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q2",
              choice: String(fd.get("choice") ?? ""),
              explain: String(fd.get("explain") ?? "").trim(),
            });
          });
        },
      };

      const q3 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              3) Mr. Williams has been helping his students learn to compare fractions. He is trying to devise an
              assignment that shows him whether his students know how to compare fractions with single-digit
              numerators and denominators but he wants to make sure he includes challenging problems.
              Which is harder to compare:
            </div>
            <form id="pck-q3-form">
              <div class="pck-choices">
                <label class="pck-choice">
                  <input type="radio" name="choice" value="A" required />
                  <span><strong>A)</strong> 3/8 vs 2/5</span>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="B" required />
                  <span><strong>B)</strong> 3/5 vs 5/8</span>
                </label>
              </div>

              <div style="margin-top: 14px;">
                <div class="pck-explain">Explain: _____ (Open response box)</div>
                <textarea class="pck-textarea" name="explain" aria-label="Explain" required></textarea>
              </div>

              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q3-form") as HTMLFormElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const fd = new FormData(form);
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q3",
              choice: String(fd.get("choice") ?? ""),
              explain: String(fd.get("explain") ?? "").trim(),
            });
          });
        },
      };

      const q4 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              4) Ms. Miller is teaching her 6th grade students about the magnitude of fractions.
              Which representation of 3/5 aligns with research on internal representations of magnitude?
            </div>
            <form id="pck-q4-form">
              <div class="pck-grid">
                <label class="pck-choice">
                  <input type="radio" name="choice" value="A" required />
                  <div>
                    <div><strong>A)</strong></div>
                    <img class="pck-image" src="${PCK_IMAGE_PATHS.q4A}" alt="Pie chart option A" />
                  </div>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="B" required />
                  <div>
                    <div><strong>B)</strong></div>
                    <img class="pck-image" src="${PCK_IMAGE_PATHS.q4B}" alt="Pie chart option B" />
                  </div>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="C" required />
                  <div>
                    <div><strong>C)</strong></div>
                    <img class="pck-image" src="${PCK_IMAGE_PATHS.q4C}" alt="Number line 0-2 option" />
                  </div>
                </label>
                <label class="pck-choice">
                  <input type="radio" name="choice" value="D" required />
                  <div>
                    <div><strong>D)</strong></div>
                    <img class="pck-image" src="${PCK_IMAGE_PATHS.q4D}" alt="Number line 0-1 option" />
                  </div>
                </label>
              </div>

              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q4-form") as HTMLFormElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const fd = new FormData(form);
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q4",
              choice: String(fd.get("choice") ?? ""),
            });
          });
        },
      };

      const q5 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              5) Miss Smith wants to know more about how her students think about fraction addition.
              She asks them what is the best estimate for 12/13 + 7/8 and provides the following estimates
              as answer choices. How do you think her 8th grade students would respond? Select the two most common estimates.
            </div>
            <form id="pck-q5-form">
              <div class="pck-choices">
                <label class="pck-choice"><input type="checkbox" name="choice" value="A" /> <span><strong>A)</strong> 1</span></label>
                <label class="pck-choice"><input type="checkbox" name="choice" value="B" /> <span><strong>B)</strong> 2</span></label>
                <label class="pck-choice"><input type="checkbox" name="choice" value="C" /> <span><strong>C)</strong> 19</span></label>
                <label class="pck-choice"><input type="checkbox" name="choice" value="D" /> <span><strong>D)</strong> 21</span></label>
                <label class="pck-choice"><input type="checkbox" name="choice" value="E" /> <span><strong>E)</strong> I do not know</span></label>
              </div>

              <div style="margin-top: 14px;">
                <div class="pck-explain">Explain: _____ (Open response box)</div>
                <textarea class="pck-textarea" name="explain" aria-label="Explain" required></textarea>
              </div>

              <div id="pck-q5-error" class="pck-error">Please select exactly two choices.</div>
              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q5-form") as HTMLFormElement | null;
          const errorEl = document.getElementById("pck-q5-error") as HTMLElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const checked = Array.from(
              form.querySelectorAll("input[name='choice']:checked")
            ) as HTMLInputElement[];
            if (checked.length !== 2) {
              if (errorEl) errorEl.style.display = "block";
              return;
            }
            if (errorEl) errorEl.style.display = "none";
            const choices = checked.map((el) => el.value);
            const fd = new FormData(form);
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q5",
              choices,
              explain: String(fd.get("explain") ?? "").trim(),
            });
          });
        },
      };

      const q6 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              6) Mr. Jones the 6th grade teacher said, "We need to find a common denominator. What do we multiply by?"
              Students respond, "Two." This is what the teacher writes on the board. Would you change anything about this exchange?
            </div>
            <div class="pck-equation">
              ${renderValueHTML("1/2")} &times; 2 = ${renderValueHTML("2/4")}
            </div>
            <form id="pck-q6-form">
              <div class="pck-choices">
                <label class="pck-choice"><input type="radio" name="choice" value="Yes" required /> <span><strong>A)</strong> Yes</span></label>
                <label class="pck-choice"><input type="radio" name="choice" value="No" required /> <span><strong>B)</strong> No</span></label>
              </div>

              <div style="margin-top: 14px;">
                <div class="pck-explain">Explain: _____ (Open response box)</div>
                <textarea class="pck-textarea" name="explain" aria-label="Explain" required></textarea>
              </div>

              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q6-form") as HTMLFormElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const fd = new FormData(form);
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q6",
              choice: String(fd.get("choice") ?? ""),
              explain: String(fd.get("explain") ?? "").trim(),
            });
          });
        },
      };

      const q7 = {
        type: HtmlKeyboardResponsePlugin,
        choices: "NO_KEYS",
        stimulus:
          pckBaseCSS +
          `
          <div class="pck-wrap">
            <div class="pck-title">PCK - Questions on how to teach rational numbers</div>
            <div class="pck-q">
              7) Mr. Johnson the 6th grade teacher said, "We need to find a common denominator. What do we multiply by?"
              Students respond, "Two." This is what the teacher writes on the board. Would you change anything about this exchange?
            </div>
            <img class="pck-image-wide" src="${PCK_IMAGE_PATHS.q7}" alt="Board example for common denominator" />
            <form id="pck-q7-form">
              <div class="pck-choices">
                <label class="pck-choice"><input type="radio" name="choice" value="Yes" required /> <span><strong>A)</strong> Yes</span></label>
                <label class="pck-choice"><input type="radio" name="choice" value="No" required /> <span><strong>B)</strong> No</span></label>
              </div>

              <div style="margin-top: 14px;">
                <div class="pck-explain">Explain: _____ (Open response box)</div>
                <textarea class="pck-textarea" name="explain" aria-label="Explain" required></textarea>
              </div>

              <div class="pck-actions">
                <button type="submit" class="pck-btn">Continue</button>
              </div>
            </form>
          </div>
          `,
        on_load: () => {
          const form = document.getElementById("pck-q7-form") as HTMLFormElement | null;
          if (!form) return;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }
            const fd = new FormData(form);
            jsPsych.finishTrial({
              task: "pck",
              phase,
              question_id: "q7",
              choice: String(fd.get("choice") ?? ""),
              explain: String(fd.get("explain") ?? "").trim(),
            });
          });
        },
      };

      return [q1, q2, q3, q4, q5, q6, q7];
    };

    const prePck = buildPckTimeline("pre");
    const postPck = buildPckTimeline("post");

    const preTask1 = buildMagnitudeComparisonTimeline({ limit: 18, orderSeed: "pre-v1" });
    const preTask2 = buildNumberLineEstimationTimeline({
      trials: preEstTrials,
      promptTitle: "NUMBER LINE ESTIMATION (PRE)",
    });

     // ✅ Monster placeholder (warm-up section)

    // Monster-Math (warm-up) section
    const monsterMathTimeline: any[] = [
      {
        type: HtmlButtonResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 40px; text-align:center;">
            <h2 style="font-size: 40px; font-weight: 900; color: #111; margin-bottom: 12px; font-family: 'Courier New', monospace;">
              Monster-Math Section
            </h2>
            <p style="font-size: 18px; color: #111; margin-bottom: 10px;">
              Quick warm-up before the post-test.
            </p>
            <p style="font-size: 16px; color: #333;">
              You'll place values on the number line and answer a few questions.
            </p>
          </div>
        `,
        choices: ["Continue"],
        data: { task: "monster_math", step: "intro_text" },
      },
      {
        type: HtmlButtonResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 40px; text-align:center;">
            <h2 style="font-size: 36px; font-weight: 900; color: #111; margin-bottom: 14px; font-family: 'Courier New', monospace;">
              Show how far the monster went.
            </h2>
            <div style="margin: 12px 0 6px 0; font-size: 28px;">
              ${renderValueHTML("1/2")}
            </div>
            <p style="font-size: 16px; color: #333;">
              This number tells you how far the monster went.
            </p>
          </div>
        `,
        choices: ["Continue"],
        data: { task: "monster_math", step: "intro_fraction" },
      },
      {
        type: HtmlSliderResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
            <img id="monster-fraction" src="/monster.png" alt="Monster" />
            <h2 style="font-size: 28px; font-weight: 900; color: #111; margin-bottom: 8px; font-family: 'Courier New', monospace;">
              Show how far the monster went.
            </h2>
            <div style="font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px;">
              <span id="live-value-fraction">50%</span>
            </div>
          </div>
        `,
        labels: ["0%", "100%"],
        min: 0,
        max: 100,
        step: 1,
        start: 50,
        require_movement: true,
        button_label: "Continue",
        on_load: () => {
          const root = jsPsych.getDisplayElement();
          const slider = root.querySelector("input[type='range']") as HTMLInputElement | null;
          const valueEl = root.querySelector("#live-value-fraction") as HTMLElement | null;
          const monsterEl = root.querySelector("#monster-fraction") as HTMLImageElement | null;
          if (slider && valueEl) {
            const update = () => {
              const v = Number(slider.value);
              valueEl.textContent = `${Math.round(v)}%`;
              if (monsterEl) {
                positionMonster(slider, monsterEl);
                if (monsterEl.naturalWidth > 0) {
                  monsterEl.style.visibility = "visible";
                }
              }
            };
            requestAnimationFrame(update);
            setTimeout(update, 0);
            slider.addEventListener("input", update);
          }
          if (slider && monsterEl) {
            monsterEl.style.position = "absolute";
            monsterEl.style.width = "53px";
            monsterEl.style.height = "auto";
            monsterEl.style.zIndex = "10";
            monsterEl.style.visibility = "hidden";
            if (monsterEl.naturalWidth === 0) {
              monsterEl.src = "/monster.png?v=1";
            }
            monsterEl.onload = () => {
              positionMonster(slider, monsterEl);
              monsterEl.style.visibility = "visible";
            };
          }
        },
        data: {
          task: "monster_math",
          step: "fraction_slider_1",
          target_label: "1/2",
          target_value_01: 0.5,
        },
      },
      {
        type: HtmlSurveyTextPlugin,
        preamble: `
          <style>
            .jspsych-content,
            .jspsych-display-element {
              color: #111 !important;
            }
            .jspsych-survey-text {
              max-width: 720px;
              margin: 0 auto;
              width: 100%;
              padding: 0 12px;
              text-align: center;
              box-sizing: border-box;
            }
            .jspsych-survey-text { color: #111 !important; }
            .jspsych-survey-text textarea,
            .jspsych-survey-text input[type="text"] {
              color: #111 !important;
              background: #cbd0d9 !important;
              border: 2px solid #111 !important;
              caret-color: #111 !important;
              box-shadow: 2px 2px 0 rgba(0,0,0,0.15) !important;
              padding: 10px !important;
              display: block !important;
              width: min(720px, 100%) !important;
              min-height: 110px !important;
              margin: 12px auto 0 auto !important;
            }
            .jspsych-survey-text label,
            .jspsych-survey-text .jspsych-survey-text-question,
            .jspsych-survey-text p {
              color: #111 !important;
            }
            .jspsych-survey-text textarea::placeholder,
            .jspsych-survey-text input::placeholder {
              color: #666 !important;
            }
            .jspsych-survey-text .jspsych-btn {
              margin: 16px auto 0 !important;
              display: block !important;
            }
            @media (max-width: 480px) {
              .jspsych-survey-text .jspsych-survey-text-question {
                font-size: 18px !important;
              }
            }
          </style>
          <div style="max-width: 920px; margin: 0 auto; padding: 10px 0 0 0; color:#111; text-align:center;">
            <p style="font-size: 16px; color:#111;">
              Quick check before the next number line.
            </p>
          </div>
        `,
        questions: [
          {
            prompt:
              "<span style='color:#111;'>What does it mean if he says he ran 100% of the race?</span>",
            required: true,
            rows: 3,
            columns: 60,
          },
        ],
        button_label: "Submit",
        on_load: () => {
          const el = document.querySelector(
            ".jspsych-survey-text textarea, .jspsych-survey-text input[type='text']"
          ) as HTMLTextAreaElement | HTMLInputElement | null;
          if (el) {
            el.style.color = "#111";
            el.style.background = "#cbd0d9";
            el.style.border = "2px solid #111";
            el.style.boxShadow = "2px 2px 0 rgba(0,0,0,0.15)";
            el.style.padding = "10px";
            el.style.display = "block";
            el.style.width = "min(720px, 100%)";
            el.style.minHeight = "110px";
            el.style.margin = "12px auto 0 auto";
          }
        },
        data: { task: "monster_math", step: "open_response_100_percent" },
      },
      {
        type: HtmlButtonResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
            <p style="font-size: 18px; color: #111; margin-bottom: 14px;">
              Exactly. 100% means the monster finished the whole race.
            </p>
            <p style="font-size: 16px; color: #333; margin-bottom: 10px;">
              On the number line, 100% = 1.
            </p>
            <p style="font-size: 16px; color: #333;">0 &nbsp; - &nbsp; 1</p>
          </div>
        `,
        choices: ["Continue"],
        data: { task: "monster_math", step: "confirm_100_percent" },
      },
      {
        type: HtmlButtonResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:left;">
            <h2 style="font-size: 26px; font-weight: 800; color: #111; margin-bottom: 12px;">
              Which decimal is closest to ${renderValueHTML("1/2")}?
            </h2>
          </div>
        `,
        choices: ["0.05", "0.5", "5.0", "50"],
        data: { task: "monster_math", step: "mc_fraction_decimal" },
      },
      {
        type: HtmlButtonResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
            <p style="font-size: 20px; font-weight: 900; color: #111; margin-bottom: 10px;">
              ${renderValueHTML("1/2")} = 0.5
            </p>
            <p style="font-size: 16px; color: #333;">Now, show it on the number line!</p>
          </div>
        `,
        choices: ["Continue"],
        data: { task: "monster_math", step: "convert_fraction_decimal" },
      },
      {
        type: HtmlSliderResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
            <img id="monster-decimal" src="/monster.png" alt="Monster" />
            <h2 style="font-size: 28px; font-weight: 900; color: #111; margin-bottom: 8px; font-family: 'Courier New', monospace;">
              Show how far the monster went.
            </h2>
          </div>
        `,
        labels: ["0", "1"],
        min: 0,
        max: 100,
        step: 1,
        start: 50,
        require_movement: true,
        button_label: "Continue",
        on_load: () => {
          const root = jsPsych.getDisplayElement();
          const slider = root.querySelector("input[type='range']") as HTMLInputElement | null;
          const monsterEl = root.querySelector("#monster-decimal") as HTMLImageElement | null;
          if (slider && monsterEl) {
            const update = () => {
              positionMonster(slider, monsterEl);
            };
            requestAnimationFrame(update);
            setTimeout(update, 0);
            slider.addEventListener("input", update);
            monsterEl.style.position = "absolute";
            monsterEl.style.width = "53px";
            monsterEl.style.height = "auto";
            monsterEl.style.zIndex = "10";
            monsterEl.style.visibility = "hidden";
            if (monsterEl.naturalWidth === 0) {
              monsterEl.src = "/monster.png?v=1";
            }
            monsterEl.onload = () => {
              positionMonster(slider, monsterEl);
              monsterEl.style.visibility = "visible";
            };
          }
        },
        data: {
          task: "monster_math",
          step: "decimal_slider",
          target_label: "0.5",
          target_value_01: 0.5,
        },
      },
      {
        type: HtmlButtonResponsePlugin,
        stimulus: () => {
          const last = jsPsych.data
            .get()
            .filter({ task: "monster_math", step: "decimal_slider" })
            .last(1)
            .values()?.[0];
          const placed =
            typeof last?.response === "number"
              ? (Number(last.response) / 100).toFixed(2)
              : "N/A";
          return `
            <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
              <p style="font-size: 18px; color: #111; margin-bottom: 10px;">
                Here's where YOU placed ${renderValueHTML("1/2")} on a previous screen.
              </p>
              <p style="font-size: 16px; color: #333; margin-bottom: 6px;">
                Your placement: <strong>${placed}</strong>
              </p>
              <p style="font-size: 16px; color: #111;">
                LOOK at the exact position showing that the monster went ${renderValueHTML("1/2")} the race!
              </p>
            </div>
          `;
        },
        choices: ["Continue"],
        data: { task: "monster_math", step: "feedback_previous_placement" },
      },
      {
        type: HtmlSliderResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
            <img id="monster-relay" src="/monster.png" alt="Monster" />
            <p style="font-size: 18px; color: #111; margin-bottom: 8px;">
              The relay partner went 0.25.
            </p>
            <p style="font-size: 16px; color: #333; margin-bottom: 8px;">
              Show how far that monster went.
            </p>
            <div style="font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px;">
              <span id="live-value-relay">25%</span>
            </div>
          </div>
        `,
        labels: ["0%", "100%"],
        min: 0,
        max: 100,
        step: 1,
        start: 25,
        require_movement: true,
        button_label: "Continue",
        on_load: () => {
          const root = jsPsych.getDisplayElement();
          const slider = root.querySelector("input[type='range']") as HTMLInputElement | null;
          const valueEl = root.querySelector("#live-value-relay") as HTMLElement | null;
          const monsterEl = root.querySelector("#monster-relay") as HTMLImageElement | null;
          if (slider && valueEl) {
            const update = () => {
              const v = Number(slider.value);
              valueEl.textContent = `${Math.round(v)}%`;
              if (monsterEl) {
                positionMonster(slider, monsterEl);
                if (monsterEl.naturalWidth > 0) {
                  monsterEl.style.visibility = "visible";
                }
              }
            };
            update();
            slider.addEventListener("input", update);
          }
          if (slider && monsterEl) {
            monsterEl.style.position = "absolute";
            monsterEl.style.width = "53px";
            monsterEl.style.height = "auto";
            monsterEl.style.zIndex = "10";
            monsterEl.style.visibility = "hidden";
            if (monsterEl.naturalWidth === 0) {
              monsterEl.src = "/monster.png?v=1";
            }
            monsterEl.onload = () => {
              positionMonster(slider, monsterEl);
              monsterEl.style.visibility = "visible";
            };
          }
        },
        data: {
          task: "monster_math",
          step: "relay_partner",
          target_label: "0.25",
          target_value_01: 0.25,
        },
      },
      {
        type: HtmlSliderResponsePlugin,
        stimulus: `
          <div style="max-width: 920px; margin: 0 auto; padding: 30px; text-align:center;">
            <img id="monster-team" src="/monster.png" alt="Monster" />
            <p style="font-size: 18px; color: #111; margin-bottom: 8px;">
              Now, put each distance together.
            </p>
            <p style="font-size: 16px; color: #333; margin-bottom: 8px;">
              Show how far the monster TEAM went.
            </p>
            <div style="font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px;">
              ${renderValueHTML("1/2")} + 0.25 = <span id="live-value-team">0.75</span>
            </div>
          </div>
        `,
        labels: ["0", "1"],
        min: 0,
        max: 100,
        step: 1,
        start: 75,
        require_movement: true,
        button_label: "Continue",
        on_load: () => {
          const root = jsPsych.getDisplayElement();
          const slider = root.querySelector("input[type='range']") as HTMLInputElement | null;
          const valueEl = root.querySelector("#live-value-team") as HTMLElement | null;
          const monsterEl = root.querySelector("#monster-team") as HTMLImageElement | null;
          if (slider && valueEl) {
            const update = () => {
              const v = Number(slider.value);
              valueEl.textContent = (v / 100).toFixed(2);
              if (monsterEl) {
                positionMonster(slider, monsterEl);
                if (monsterEl.naturalWidth > 0) {
                  monsterEl.style.visibility = "visible";
                }
              }
            };
            update();
            slider.addEventListener("input", update);
          }
          if (slider && monsterEl) {
            monsterEl.style.position = "absolute";
            monsterEl.style.width = "53px";
            monsterEl.style.height = "auto";
            monsterEl.style.zIndex = "10";
            monsterEl.style.visibility = "hidden";
            if (monsterEl.naturalWidth === 0) {
              monsterEl.src = "/monster.png?v=1";
            }
            monsterEl.onload = () => {
              positionMonster(slider, monsterEl);
              monsterEl.style.visibility = "visible";
            };
          }
        },
        data: {
          task: "monster_math",
          step: "team_total",
          target_label: "1/2 + 0.25",
          target_value_01: 0.75,
        },
      },
    ];

    

    const postTask1 = buildMagnitudeComparisonTimeline({ limit: 18, orderSeed: "post-v1" });
    const postTask2 = buildNumberLineEstimationTimeline({
      trials: postEstTrials,
      promptTitle: "NUMBER LINE ESTIMATION (POST)",
    });
      const resumeChooser = {
  timeline: [
    {
      type: HtmlButtonResponsePlugin,
      stimulus: () => {
        const pid = ((window as any).__participantId ?? "").toString().trim();
        const s = pid ? getSession(pid) : null;

        return `
          <div style="max-width: 920px; margin: 0 auto; padding: 40px; text-align:center;">
            <h2 style="font-size: 40px; font-weight: 900; color: #111; margin-bottom: 10px; font-family: 'Courier New', monospace;">
              Session found
            </h2>
            <p style="font-size: 16px; color: #333; margin-bottom: 18px;">
              ID: <strong>${pid}</strong><br/>
              Last saved: <strong>${s?.updatedAt ?? "unknown"}</strong>
            </p>
            <p style="font-size: 16px; color: #111; margin-bottom: 18px;">
              Do you want to resume from the Post-test (Monster → Post), or start over?
            </p>
          </div>
        `;
      },
      choices: ["Resume", "Start new"],
      on_finish: (data: any) => {
        const pid = ((window as any).__participantId ?? "").toString().trim();
        const s = pid ? getSession(pid) : null;

        // 0 = Resume, 1 = Start new
        const resume = data.response === 0;

        (window as any).__resumeFlow = resume;
        (window as any).__sessionRow = s;

        if (!resume && pid) clearSession(pid);
      },
      data: { task: "resume_choice" },
    },
  ],
  conditional_function: () => {
    const pid = ((window as any).__participantId ?? "").toString().trim();
    if (!pid) return false;
    const s = getSession(pid);
    // show this only if we have a saved PRE checkpoint
    return !!s && (s.stage === "PRE_DONE" || s.stage === "MONSTER_DONE");
  },
};

const timeline: any[] = [
  ...buildConsentAndIdTimeline({ title: "Numeracy Screener" }),

  // shows only if a saved session exists for this ID
  resumeChooser,

  // PRE (skip if resumeFlow = true)
  {
    timeline: preTask1,
    data: { phase: "pre" },
    conditional_function: () => !(window as any).__resumeFlow,
  },

  {
    timeline: preTask2,
    data: { phase: "pre" },
    conditional_function: () => !(window as any).__resumeFlow,
  },

  {
    timeline: preArithmetic,
    data: { phase: "pre" },
    conditional_function: () => !(window as any).__resumeFlow,
  },

  {
    timeline: prePck,
    data: { phase: "pre" },
    conditional_function: () => !(window as any).__resumeFlow,
    on_timeline_finish: () => {
      // only save checkpoint when actually running PRE
      if (!(window as any).__resumeFlow) savePreCheckpoint();
    },
  },

  {
    timeline: monsterMathTimeline,
    data: { phase: "monster" },
    on_timeline_finish: () => saveMonsterCheckpoint(),
  },
 
  // POST (always runs)
  { timeline: postTask1, data: { phase: "post" } },
  { timeline: postTask2, data: { phase: "post" } },
  { timeline: postArithmetic, data: { phase: "post" } },
  { timeline: postPck, data: { phase: "post" } },
];

                        

    jsPsych.run(timeline);
  }, [onFinish]);

  return (
    <div
      id={experimentDivId}
      className="w-full h-full min-h-[600px] flex flex-col items-center justify-center"
    />
  );
};

export default JsPsychExperiment;
