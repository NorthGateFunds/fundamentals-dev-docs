// assets/integrator-modal.js
(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function safeStr(v) {
    return v === undefined || v === null ? "" : String(v);
  }

  function isEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  }

  function readForm(formEl) {
    const fd = new FormData(formEl);
    const obj = {};
    fd.forEach((v, k) => {
      obj[k] = safeStr(v).trim();
    });
    return obj;
  }

  function setText(el, t) {
    if (!el) return;
    el.textContent = t || "";
  }

  function setHtml(el, h) {
    if (!el) return;
    el.innerHTML = h || "";
  }

  function disableBtn(btn, text) {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset._oldText = btn.textContent || "";
    if (text) btn.textContent = text;
  }

  function enableBtn(btn) {
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset._oldText) btn.textContent = btn.dataset._oldText;
  }

  // Local convenience only (DB is the real source of truth)
  const LS_KEY = "fw_integrator_modal_state_v1";

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveState(patch) {
    const cur = loadState();
    const next = Object.assign({}, cur, patch);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
    return next;
  }

  async function submitRequest(kind, payload) {
    const res = await fetch("/api/integrator-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ kind }, payload)),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j || !j.ok) {
      const err = j && j.error ? j.error : "submit_failed";
      throw new Error(err);
    }
    return j.id || null;
  }

  function mount() {
    const scrim = $("[data-fw-modal-scrim]");
    const modal = $("[data-fw-modal]");
    if (!scrim || !modal) return;

    const sub = $("[data-fw-modal-sub]", modal);
    const closeBtns = $all("[data-fw-modal-close]", modal);

    const step1Form = $("[data-fw-step1-form]", modal);
    const step1Status = $("[data-fw-step1-status]", modal);

    const step2Lock = $("[data-fw-step2-lock]", modal);
    const step2Form = $("[data-fw-step2-form]", modal);
    const step2Status = $("[data-fw-step2-status]", modal);
    const step2Confirm = $("[data-fw-step2-confirm]", modal);
    const step2Submit = $("[data-fw-step2-submit]", modal);

    let lastFocus = null;

    function syncStep2Lock() {
      const st = loadState();
      const step1Saved = !!(st && st.step1 && st.step1.step1_saved_id);

      if (step2Lock) step2Lock.style.display = step1Saved ? "none" : "flex";
      if (step2Form) step2Form.style.opacity = step1Saved ? "1" : "0.55";
      if (step2Form) step2Form.style.pointerEvents = step1Saved ? "auto" : "none";

      const canSubmit = step1Saved && step2Confirm && step2Confirm.checked;
      if (step2Submit) step2Submit.disabled = !canSubmit;
    }

    function openModal(mode) {
      lastFocus = document.activeElement;

      const titleEl = $("#fwModalTitle");
      if (mode === "custom") {
        setText(titleEl, "Request an integration");
        setText(sub, "Tell us what you’re building. We’ll follow up with the right delivery option.");
      } else {
        setText(titleEl, "Set up HTTPS Push");
        setText(sub, "Two steps: save your contact + endpoint, then enable ongoing delivery.");
      }

      scrim.classList.remove("fwHidden");
      modal.classList.remove("fwHidden");

      const st = loadState();

      // Restore step 1 values
      if (step1Form) {
        const s1 = (st && st.step1) || {};
        const e = step1Form.querySelector('input[name="email"]');
        const c = step1Form.querySelector('input[name="company"]');
        const u = step1Form.querySelector('input[name="endpoint_url"]');
        const env = step1Form.querySelector('select[name="delivery_env"]');
        const n = step1Form.querySelector('textarea[name="notes"]');
        if (e && s1.email) e.value = s1.email;
        if (c && s1.company) c.value = s1.company;
        if (u && s1.endpoint_url) u.value = s1.endpoint_url;
        if (env && s1.delivery_env) env.value = s1.delivery_env;
        if (n && s1.notes) n.value = s1.notes;
      }

      // Restore step 2 values
      if (step2Form) {
        const s2 = (st && st.step2) || {};
        const name = step2Form.querySelector('input[name="name"]');
        const role = step2Form.querySelector('input[name="role"]');
        const u2 = step2Form.querySelector('input[name="endpoint_url"]');
        const env2 = step2Form.querySelector('select[name="delivery_env"]');
        const fmt = step2Form.querySelector('select[name="format_preference"]');
        const n2 = step2Form.querySelector('textarea[name="notes"]');
        if (name && s2.name) name.value = s2.name;
        if (role && s2.role) role.value = s2.role;
        if (u2 && s2.endpoint_url) u2.value = s2.endpoint_url;
        if (env2 && s2.delivery_env) env2.value = s2.delivery_env;
        if (fmt && s2.format_preference) fmt.value = s2.format_preference;
        if (n2 && s2.notes) n2.value = s2.notes;
      }

      syncStep2Lock();

      const first = modal.querySelector("input, select, textarea, button");
      if (first) setTimeout(() => first.focus(), 30);
    }

    function closeModal() {
      scrim.classList.add("fwHidden");
      modal.classList.add("fwHidden");
      setText(step1Status, "");
      setText(step2Status, "");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    // Open triggers
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-open-integrator-modal]");
      if (!a) return;
      e.preventDefault();
      openModal(a.getAttribute("data-open-integrator-modal") || "newsml");
    });

    // Close triggers
    closeBtns.forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal();
      })
    );
    scrim.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("fwHidden") && e.key === "Escape") closeModal();
    });

    // Step 2 checkbox gating
    if (step2Confirm) step2Confirm.addEventListener("change", syncStep2Lock);

    // Step 1 submit: push_access
    if (step1Form) {
      step1Form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setText(step1Status, "");

        const payload = readForm(step1Form);

        if (!payload.email || !isEmail(payload.email)) {
          setHtml(step1Status, "<strong>Enter a valid work email.</strong>");
          const el = step1Form.querySelector('input[name="email"]');
          if (el) el.focus();
          return;
        }

        // Save draft locally
        saveState({ step1: payload });

        const btn = step1Form.querySelector('button[type="submit"]');
        disableBtn(btn, "Saving…");

        try {
          const id = await submitRequest(
            "push_access",
            Object.assign({}, payload, {
              source_path: window.location.pathname,
            })
          );

          saveState({ step1: Object.assign({}, payload, { step1_saved_id: id || true }) });

          setHtml(step1Status, "<strong>Saved.</strong> Step 2 is now available.");

          // Best-effort: copy endpoint/env into step 2 if blank
          if (step2Form && payload.endpoint_url) {
            const u2 = step2Form.querySelector('input[name="endpoint_url"]');
            if (u2 && !u2.value) u2.value = payload.endpoint_url;
          }
          if (step2Form && payload.delivery_env) {
            const env2 = step2Form.querySelector('select[name="delivery_env"]');
            if (env2 && !env2.value) env2.value = payload.delivery_env;
          }

          syncStep2Lock();
        } catch {
          setHtml(step1Status, "<strong>Couldn’t save.</strong> Try again.");
        } finally {
          enableBtn(btn);
        }
      });

      step1Form.addEventListener("input", () => {
        const payload = readForm(step1Form);
        const st = loadState();
        saveState({ step1: Object.assign({}, (st.step1 || {}), payload) });
      });
    }

    // Step 2 submit: integration (enable ongoing)
    if (step2Form) {
      step2Form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setText(step2Status, "");

        const st = loadState();
        const s1 = (st && st.step1) || {};
        const step1Saved = !!s1.step1_saved_id;

        if (!step1Saved) {
          setHtml(step2Status, "<strong>Complete step 1 first.</strong>");
          return;
        }

        if (!step2Confirm || !step2Confirm.checked) {
          setHtml(step2Status, "<strong>Confirm your endpoint behavior to continue.</strong>");
          return;
        }

        const payload2 = readForm(step2Form);
        saveState({ step2: payload2 });

        const merged = {
          email: s1.email || "",
          company: s1.company || "",
          endpoint_url: payload2.endpoint_url || s1.endpoint_url || "",
          delivery_env: payload2.delivery_env || s1.delivery_env || "",
          name: payload2.name || null,
          role: payload2.role || null,
          format_preference: payload2.format_preference || "NewsML",
          notes: payload2.notes || null,
          source_path: window.location.pathname,
        };

        if (!merged.email || !isEmail(merged.email)) {
          setHtml(step2Status, "<strong>Missing email.</strong> Go back to step 1.");
          return;
        }
        if (!merged.endpoint_url) {
          setHtml(step2Status, "<strong>Endpoint URL is required</strong> to enable ongoing delivery.");
          const el = step2Form.querySelector('input[name="endpoint_url"]');
          if (el) el.focus();
          return;
        }

        disableBtn(step2Submit, "Enabling…");

        try {
          await submitRequest("integration", merged);
          setHtml(step2Status, "<strong>Submitted.</strong> Ongoing delivery request received.");
        } catch {
          setHtml(step2Status, "<strong>Couldn’t submit.</strong> Try again.");
        } finally {
          enableBtn(step2Submit);
          syncStep2Lock();
        }
      });

      step2Form.addEventListener("input", () => {
        const payload2 = readForm(step2Form);
        const st = loadState();
        saveState({ step2: Object.assign({}, (st.step2 || {}), payload2) });
      });
    }

    // Initialize locked state in case modal is already visible (rare)
    syncStep2Lock();
  }

  document.addEventListener("DOMContentLoaded", mount);
})();