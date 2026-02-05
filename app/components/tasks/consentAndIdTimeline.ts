// app/components/tasks/consentAndIdTimeline.ts

import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import HtmlSurveyTextPlugin from "@jspsych/plugin-survey-text";

type BuildOptions = {
  title?: string;
};

export function buildConsentAndIdTimeline(options: BuildOptions = {}) {
  const title = options.title ?? "Numeracy Screener";
  const timeline: any[] = [];

  const legibilityCSS = `
<style>
  .jspsych-content { color: #111 !important; }
  .jspsych-content * { color: #111 !important; }

  .consent-btn {
    font-family: "Courier New", monospace;
    font-weight: 900;
    border: 3px solid #111;
    border-radius: 14px;
    padding: 12px 16px;
    margin: 8px;
    cursor: pointer;
    background: #ffffff;
    color: #111;
  }
  .consent-btn:hover { transform: rotate(-1deg) scale(1.02); }

  .jspsych-survey-text label {
    font-weight: 900 !important;
    font-size: 18px !important;
  }

  .jspsych-survey-text input[type="text"] {
    color: #111 !important;
    background: #fff !important;
    border: 3px solid #111 !important;
    border-radius: 12px !important;
    padding: 12px 14px !important;
    font-size: 18px !important;
    width: min(520px, 100%) !important;
    outline: none !important;
  }

  /* Extra safety for endExperiment screens */
  .consent-end, .consent-end * { color: #111 !important; }
  
</style>
`;

  const declineHTML =
    legibilityCSS +
    `
<div class="consent-end" style="max-width: 800px; margin: 0 auto; padding: 40px; text-align: center;">
  <h2 style="font-size: 34px; font-weight: 900; margin-bottom: 10px; font-family: 'Courier New', monospace; color:#111;">
    No problem
  </h2>
  <p style="font-size: 18px; color:#111;">
    You chose not to participate. You can close this page now.
  </p>
</div>
`;

  // Reset decision each run
  (window as any).__consentDecision = null;

  // 1) Consent screen (custom buttons)
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    choices: "NO_KEYS",
    stimulus:
      legibilityCSS +
      `
<div style="max-width: 860px; margin: 0 auto; padding: 30px;">
  <h1 style="font-size: 44px; font-weight: 900; color: #111; margin-bottom: 10px; font-family: 'Courier New', monospace;">
    INFORMED CONSENT
  </h1>

  <div style="background: #fff; border: 3px solid #111; border-radius: 18px; padding: 18px; box-shadow: 6px 6px 0px rgba(0,0,0,0.18);">
    <p style="margin: 0 0 8px 0; font-size: 16px; color:#111;">
      <strong>Title of Project:</strong> Educator Cross-Notation Abilities
    </p>
    <p style="margin: 0 0 8px 0; font-size: 16px; color:#111;">
      <strong>Researchers (PI and Co-PI):</strong> Lauren Schiller and Karen Woodruff
    </p>
    <p style="margin: 0 0 8px 0; font-size: 16px; color:#111;">
      <strong>Department:</strong> Elementary and Physical Education, College of Education
    </p>
    <p style="margin: 0; font-size: 16px; color:#111;">
      <strong>Contact Information:</strong> Dr. Schiller: (908) 737-3827, lschille@kean.edu; Dr. Woodruff:
      (908) 737-3810, kwoodruf@kean.edu
    </p>
  </div>

  <div style="margin-top: 18px; font-size: 16px; line-height: 1.6; color:#111;">
    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">I. Invitation to Participate</h3>
    <p style="margin: 0 0 8px 0;">
      You are being invited to participate in this research study called, "Educator Cross-Notation Abilities."
      We are hoping to learn what preservice teachers know about fractions, decimals, and percentages and
      whether such knowledge could be improved with a brief educational game.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">II. Purpose of Study</h3>
    <p style="margin: 0 0 8px 0;">
      The purpose of the study is to determine what preservice teachers know about fractions, decimals,
      and percentages. We also would like to determine whether a brief math game could help improve
      their knowledge.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">III. Participant Selection</h3>
    <p style="margin: 0 0 8px 0;">
      You are being invited to participate because you are considered a preservice teacher, someone who is
      studying to become an elementary education teacher.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">IV. Procedures</h3>
    <p style="margin: 0 0 8px 0;">
      You will first take a brief test on the computer that should last about 15-20 minutes to measure your
      level of knowledge about fractions, decimals, and percentages. Then, you will play a math game that
      should last about 15-20 minutes. We are trying to determine whether this game is helpful. Finally,
      you will take another test that will last about 15-20 minutes to measure if there are any changes in
      your knowledge about fractions, decimals, and percentages. You might feel bored, uncomfortable, or
      anxious answering math questions but these questions should be no different from other math
      questions you have encountered before.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">V. Potential Risks</h3>
    <p style="margin: 0 0 8px 0;">
      A potential risk is that your identity could be revealed. However, the PI and Co-PI will work to
      ensure that participants will remain anonymous and whether (or not) their students participate in the
      study will remain private. The PI will keep all written materials locked in a desk drawer in a locked
      office. Any electronic or digital information will be stored on a computer that is password protected.
      There will be a written record matching your name with your study ID number, which will be kept in a
      locked filing cabinet and destroyed prior to analyzing the data. All assessment data and participant
      work will use de-identified study ID numbers and the master list identifying the subject will be kept
      locked and separate from the list of study ID numbers.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">VI. Potential Benefits</h3>
    <p style="margin: 0 0 8px 0;">There is no direct benefit.</p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">VII. Financial Obligation</h3>
    <p style="margin: 0 0 8px 0;">There are no costs for you to participate in this study.</p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">VIII. Compensation/Treatment</h3>
    <p style="margin: 0 0 8px 0;">There is no compensation.</p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">IX. Confidentiality</h3>
    <p style="margin: 0 0 8px 0;">
      The results of this study will be published in journals and presented at academic conferences. Your
      identity will be removed from any data you provide before publication or use for educational
      purposes. Your name or any identifying information about you will not be published. De-identified
      data may be used for future research studies, or distributed to another researcher for future research
      without additional informed consent.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">X. Participation</h3>
    <p style="margin: 0 0 8px 0;">
      Participation in this research study is completely voluntary. If at any time you decide that you do not
      want to participate in this study, your participation will be withdrawn without penalty. Your
      participation (or not) in this study will not bear influence on your class standing or grade. Your
      participation (or not) will be kept private from your class instructor.
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">Questions/Comments</h3>
    <p style="margin: 0 0 8px 0;">
      If you have any questions, please contact the PI or Co-PI (Lauren Schiller and Karen Woodruff).
      You can also contact the IRB if you have questions regarding your rights as research participants.
    </p>
    <p style="margin: 0 0 8px 0;">
      <strong>Contact Information</strong><br/>
      Primary Investigator: (908) 737-3827 or lschille@kean.edu<br/>
      Co-Primary Investigator: (908) 737-3810 or kwoodruf@kean.edu<br/>
      IRB: (908) 737-3461 or IRB@kean.edu
    </p>

    <h3 style="margin: 12px 0 6px; font-size: 18px; font-weight: 900;">Agreement to Participate</h3>
    <p style="margin: 0;">
      Clicking "I agree to participate in the research study" indicates that you have read and understood
      the information provided in this document, and that you agree to participate in this study. If at any
      time you have questions or concerns regarding this study, you should feel free to contact the primary
      investigator at the telephone numbers or email addresses provided in this document.
    </p>
  </div>

  <p style="margin-top: 18px; font-size: 16px; color:#111;">
    By clicking <strong>I Agree</strong>, you indicate that you are at least 18 years old and consent to participate.
  </p>

  <div style="margin-top: 18px;">
    <button id="consent-agree" class="consent-btn">I Agree</button>
    <button id="consent-decline" class="consent-btn">I Do Not Agree</button>
  </div>
</div>
`,
    data: { task: "consent" },
    on_load: () => {
      const jsPsych = (window as any).jsPsych;

      const agreeBtn = document.getElementById("consent-agree");
      const declineBtn = document.getElementById("consent-decline");

      if (agreeBtn) {
        agreeBtn.onclick = () => {
          (window as any).__consentDecision = "agree";
          jsPsych.finishTrial({ consented: true, decision: "agree" });
        };
      }

      if (declineBtn) {
        declineBtn.onclick = () => {
          (window as any).__consentDecision = "decline";
          if (jsPsych?.endExperiment) {
            jsPsych.endExperiment(declineHTML);
          } else {
            const el = document.querySelector(".jspsych-content");
            if (el) el.innerHTML = declineHTML;
          }
        };
      }
    },
  });



  // 1b) Demographics (single-page form) after consent
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    choices: "NO_KEYS",
    stimulus:
      legibilityCSS +
      `
<div style="max-width: 860px; margin: 0 auto; padding: 20px 30px;">
  <h2 style="font-size: 34px; font-weight: 900; margin-bottom: 8px; font-family: 'Courier New', monospace; color:#111;">
    Demographic Questions
  </h2>
  <form id="demographics-form" style="display:flex; flex-direction:column; gap:16px;">
    <div>
      <label style="font-weight:900; display:block; margin-bottom:6px;">Are you a teacher or administrator?</label>
      <label style="margin-right:16px;"><input type="radio" name="role_type" value="Teacher" required /> Teacher</label>
      <label><input type="radio" name="role_type" value="Administrator" required /> Administrator</label>
    </div>

    <div>
      <label style="font-weight:900; display:block; margin-bottom:6px;">Describe your role:</label>
      <textarea name="role_desc" rows="3" required
        style="width:min(720px,100%); border:3px solid #111; border-radius:12px; padding:10px; background:#fff;"></textarea>
    </div>

    <div>
      <label style="font-weight:900; display:block; margin-bottom:6px;">
        What grade level (age) do you primarily serve? (Select all that apply)
      </label>
      <div style="display:flex; flex-wrap:wrap; gap:12px;">
        <label><input type="checkbox" name="grade_level" value="Preschool" /> Preschool</label>
        <label><input type="checkbox" name="grade_level" value="K-2" /> K-2 grades</label>
        <label><input type="checkbox" name="grade_level" value="3-5" /> 3-5</label>
        <label><input type="checkbox" name="grade_level" value="6-8" /> 6-8</label>
        <label><input type="checkbox" name="grade_level" value="High School" /> High School</label>
        <label><input type="checkbox" name="grade_level" value="College" /> College</label>
      </div>
    </div>

    <div>
      <label style="font-weight:900; display:block; margin-bottom:6px;">
        How many years have you been in your current position?
      </label>
      <select name="years_in_position" required
        style="width:min(360px,100%); border:3px solid #111; border-radius:12px; padding:10px; background:#fff;">
        <option value="" disabled selected>Select one</option>
        <option value="0-1">0-1 years</option>
        <option value="2-5">2-5 years</option>
        <option value="6-10">6-10 years</option>
        <option value="11-15">11-15 years</option>
        <option value="16+">16+ years</option>
      </select>
    </div>

    <div>
      <label style="font-weight:900; display:block; margin-bottom:6px;">
        What level of math expertise do you have?
      </label>
      <select name="math_expertise" required
        style="width:min(360px,100%); border:3px solid #111; border-radius:12px; padding:10px; background:#fff;">
        <option value="" disabled selected>Select one</option>
        <option value="Beginner">Beginner</option>
        <option value="Intermediate">Intermediate</option>
        <option value="Advanced">Advanced</option>
        <option value="Expert">Expert</option>
      </select>
    </div>

    <div>
      <label style="font-weight:900; display:block; margin-bottom:6px;">
        If you'd like to share your email for future contact (optional):
      </label>
      <input type="email" name="email"
        style="width:min(520px,100%); border:3px solid #111; border-radius:12px; padding:10px; background:#fff;"
        placeholder="name@example.com" />
    </div>

    <div id="demographics-error" style="color:#b91c1c; font-weight:700; display:none;">
      Please select at least one grade level.
    </div>

    <div>
      <button type="submit" class="consent-btn">Continue</button>
    </div>
  </form>
</div>
`,
    data: { task: "demographics" },
    conditional_function: () => (window as any).__consentDecision === "agree",
    on_load: () => {
      const jsPsych = (window as any).jsPsych;
      const form = document.getElementById("demographics-form") as HTMLFormElement | null;
      const errorEl = document.getElementById("demographics-error");
      if (!form) return;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const fd = new FormData(form);
        const gradeLevels = fd.getAll("grade_level").map((v) => String(v));
        if (gradeLevels.length === 0) {
          if (errorEl) errorEl.style.display = "block";
          return;
        }
        if (errorEl) errorEl.style.display = "none";

        jsPsych.finishTrial({
          role_type: String(fd.get("role_type") ?? ""),
          role_desc: String(fd.get("role_desc") ?? "").trim(),
          grade_levels: gradeLevels,
          years_in_position: String(fd.get("years_in_position") ?? ""),
          math_expertise: String(fd.get("math_expertise") ?? ""),
          email: String(fd.get("email") ?? "").trim() || null,
        });
      });
    },
  });

  // 2) Participant ID entry ONLY if agreed
  timeline.push({
    type: HtmlSurveyTextPlugin,
    preamble:
      legibilityCSS +
      `
<div style="max-width: 860px; margin: 0 auto; padding: 10px 30px 0 30px;">
  <h2 style="font-size: 34px; font-weight: 900; margin-bottom: 6px; font-family: 'Courier New', monospace; color:#111;">
    Participant ID
  </h2>
  <p style="font-size: 16px; color:#111;">
    Enter your assigned participant ID (or a short code). Do not enter your name.
  </p>
</div>
`,
    questions: [
      {
        prompt: "Participant ID",
        name: "participant_id",
        required: true,
        placeholder: "e.g., KNU-0421",
      },
    ],
    data: { task: "id_entry" },
    conditional_function: () => (window as any).__consentDecision === "agree",
    on_load: () => {
      const input = document.querySelector(
        ".jspsych-survey-text input[type='text']"
      ) as HTMLInputElement | null;
      if (input) {
        input.disabled = false;
        input.readOnly = false;
        input.style.pointerEvents = "auto";
        input.focus();
      }
    },
    on_finish: (data: any) => {
  const raw = data.response?.participant_id ?? "";
  const pid = String(raw).trim();
  data.participant_id = pid;

  // Make it available to the router trial
  (window as any).__participantId = pid;

  // optional: attach to jsPsych-wide properties
  const jsPsych = (window as any).jsPsych;
  if (jsPsych?.data?.addProperties) jsPsych.data.addProperties({ participant_id: pid });
},

  });

  return timeline;
}
