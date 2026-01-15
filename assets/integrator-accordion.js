
// --- FW_BASE override (injected) ---
const FW_BASE_META = document.querySelector('meta[name="fw-base"]');
const FW_BASE_META = document.querySelector('meta[name="fw-base"]');

let FW_API_BASE = (FW_BASE_META && (FW_BASE_META.getAttribute("content") || "").trim()) || "";

// If we're on Cloudflare Pages (*.pages.dev), always send form traffic to Vercel,
// because Vercel is where the serverless /api handlers live.
try {
  const host = String(window.location.hostname || "");
  if (!FW_API_BASE && host.endsWith("pages.dev")) {
    FW_API_BASE = "https://fundamentals-dev-docs.vercel.app";
  }
} catch {}

function fwApiUrl(pathname) {
  const p = String(pathname || "").startsWith("/") ? String(pathname || "") : "/" + String(pathname || "");
  return (FW_API_BASE ? FW_API_BASE : "") + p;
}
// --- end injected ---

// assets/integrator-accordion.js
(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // Base URL support:
  // - default: same-origin (""), good for Vercel
  // - for Cloudflare Pages: set <meta name="fw-base" content="https://fundamentals-dev-docs.vercel.app" />
  function fwBase() {
    var meta = document.querySelector('meta[name="fw-base"]');
    var v = meta && meta.getAttribute("content");
    v = (v || "").trim();
    if (!v) return "";
    return v.replace(/\/+$/, "");
  }

  function apiUrl(path) {
    return fwBase() + path;
  }

  function fwBase() {
  var m = document.querySelector('meta[name="fw-base"]');
  var v = m && m.getAttribute("content");
  v = (v || "").trim();
  if (!v) return "";            // default same-origin
  if (v.endsWith("/")) v = v.slice(0, -1);
  return v;
}

function apiUrl(path) {
  return fwBase() + path;       // "" + "/api/..." OR "https://xyz" + "/api/..."
}

  function safeClosest(el, sel) {
    if (!el) return null;
    if (el.closest) return el.closest(sel);
    // very old fallback
    while (el && el.nodeType === 1) {
      if (matches(el, sel)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function matches(el, sel) {
    var p =
      el.matches ||
      el.webkitMatchesSelector ||
      el.msMatchesSelector ||
      el.mozMatchesSelector;
    return p ? p.call(el, sel) : false;
  }

  function setAriaExpanded(key, val) {
    qsa('[data-open-accordion="' + key + '"]').forEach(function (a) {
      a.setAttribute("aria-expanded", val ? "true" : "false");
    });
  }

  function panelIdFor(key) {
    if (key === "pushAccess") return "pushAccessAccordion";
    if (key === "integration") return "integrationAccordion";
    return null;
  }

  function closeAccordion(key) {
    var id = panelIdFor(key);
    if (!id) return;
    var panel = document.getElementById(id);
    if (panel) panel.setAttribute("aria-hidden", "true");
    setAriaExpanded(key, false);
  }

  function closeAllAccordions() {
    closeAccordion("pushAccess");
    closeAccordion("integration");
  }

  function openAccordion(key) {
    closeAllAccordions();

    var id = panelIdFor(key);
    if (!id) return;

    var panel = document.getElementById(id);
    if (!panel) return;

    panel.setAttribute("aria-hidden", "false");
    setAriaExpanded(key, true);

    // scroll into view nicely
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // focus first input
    var first = qs("input, textarea, select", panel);
    if (first) {
      setTimeout(function () {
        try {
          first.focus();
        } catch (e) {}
      }, 50);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // fallback
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  // NOTE:
  // This hits /api/integrator-request which MUST be backed by a real server.
  // On Cloudflare Pages, set <meta name="fw-base" content="https://fundamentals-dev-docs.vercel.app" />
  async function submitIntegratorRequest(_kind, payload) {
    var url = apiUrl("/api/integrator-request");

    var res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    var json = await res.json().catch(function () {
      return {};
    });

    if (!res.ok || !json.ok) throw new Error(json.error || "submit_failed");
    return json; // return the whole object so UI can show delivery status
  }

  function setStatus(form, msg) {
    var el = qs('[data-fw-status], .fstatus, [aria-live="polite"]', form);
    if (el) el.textContent = msg || "";
  }

  function disableSubmit(form, disabled, text) {
    var btn = qs('button[type="submit"]', form);
    if (!btn) return;

    if (disabled) {
      btn.disabled = true;
      btn.dataset.oldText = btn.textContent || "";
      btn.textContent = text || "Submitting…";
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.oldText || btn.textContent || "Submit";
    }
  }

  // ---------- Wizard helpers (Option B) ----------

  function mountWizard(panel) {
    var root = qs("[data-fw-wizard]", panel) || panel;

    var rail = qs("[data-fw-rail]", root);

    var step1View =
      qs('[data-fw-step-view="1"]', root) || qs("[data-fw-step1]", root);
    var step2View =
      qs('[data-fw-step-view="2"]', root) || qs("[data-fw-step2]", root);

    if (!step1View && !step2View) return;

    var step1Item = rail ? qs('[data-fw-rail-item="1"]', rail) : null;
    var step2Item = rail ? qs('[data-fw-rail-item="2"]', rail) : null;

    var badge1 = qs('[data-fw-badge="1"]', root);
    var badge2 = qs('[data-fw-badge="2"]', root);

    var step2Lock = qs("[data-fw-step2-lock]", root) || qs("#fwStep2Locked", root);
    var step2Submit = qs("#fwEnableBtn", root) || qs('[data-fw-step2-submit]', root);
    var step2Ready = qs("#fw_ready", root) || qs('[data-fw-step2-ready]', root);

    var testForm = qs("#fwTestForm", root) || qs('[data-fw-step1-form]', root);
    var enableForm = qs("#fwEnableForm", root) || qs('[data-fw-step2-form]', root);

    var lastEmail = "";
    var unlocked = false;

    function setActiveStep(n) {
      if (step1View) step1View.style.display = n === 1 ? "" : "none";
      if (step2View) step2View.style.display = n === 2 ? "" : "none";

      if (step1Item) step1Item.setAttribute("data-active", n === 1 ? "true" : "false");
      if (step2Item) step2Item.setAttribute("data-active", n === 2 ? "true" : "false");
      if (step1Item) step1Item.setAttribute("aria-current", n === 1 ? "step" : "false");
      if (step2Item) step2Item.setAttribute("aria-current", n === 2 ? "step" : "false");

      var view = n === 1 ? step1View : step2View;
      if (view) {
        var first = qs("input, textarea, select, button", view);
        if (first) {
          setTimeout(function () {
            try {
              first.focus();
            } catch (e) {}
          }, 50);
        }
      }
    }

    function updateStep2Availability() {
      var ok = unlocked && step2Ready && step2Ready.checked;
      if (step2Submit) step2Submit.disabled = !ok;
    }

    function setUnlocked(v) {
      unlocked = !!v;

      if (step2Lock) step2Lock.style.display = unlocked ? "none" : "";
      if (step2Item) step2Item.setAttribute("data-locked", unlocked ? "false" : "true");

      updateStep2Availability();
    }

    if (badge1) badge1.textContent = "Test delivery";
    if (badge2) badge2.textContent = "Enable ongoing";

    setUnlocked(false);
    setActiveStep(1);

    if (step1Item) {
      step1Item.addEventListener("click", function (e) {
        e.preventDefault();
        setActiveStep(1);
      });
    }
    if (step2Item) {
      step2Item.addEventListener("click", function (e) {
        e.preventDefault();
        if (!unlocked) {
          if (testForm) setStatus(testForm, "Run the test to unlock permanent deliveries.");
          setActiveStep(1);
          return;
        }
        setActiveStep(2);
      });
    }

    if (step2Ready) step2Ready.addEventListener("change", updateStep2Availability);

    // Step 1 submit
    if (testForm && !testForm.__fwBound) {
      testForm.__fwBound = true;

      testForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        setStatus(testForm, "");
        disableSubmit(testForm, true, "Sending…");

        var emailEl =
          qs("#fw_email", testForm) ||
          qs('input[name="email"]', testForm) ||
          qs("#fw_s1_email", testForm);

        var endpointEl =
          qs("#fw_test_endpoint", testForm) ||
          qs("#fw_endpoint", testForm) ||
          qs('input[name="endpoint_url"]', testForm);

        var email = (emailEl && emailEl.value ? emailEl.value : "").trim();
        var endpoint = (endpointEl && endpointEl.value ? endpointEl.value : "").trim();

        lastEmail = email;

        try {
          var out = await submitIntegratorRequest("push_access", {
            kind: "push_access",
            email: email,
            endpoint_url: endpoint,
            delivery_env: "test",
            notes: "Docs: HTTPS Push Step 1 (test delivery).",
            source_path: window.location.pathname,
          });

          // If backend returns delivery status, show it immediately.
          if (out && out.attempted) {
            setStatus(
              testForm,
              out.delivered
                ? "Submitted. Test delivery succeeded (HTTP " + out.http_status + "). Check Webhook.site inbox."
                : "Submitted. Test delivery attempted but failed. Check endpoint and try again."
            );
          } else {
            setStatus(testForm, "Submitted. Test delivery is being sent now.");
          }

          setUnlocked(true);
          setActiveStep(2);
        } catch (err) {
          setUnlocked(false);
          setStatus(testForm, "Couldn’t submit. Check your inputs and try again.");
          setActiveStep(1);
        } finally {
          disableSubmit(testForm, false);
          updateStep2Availability();
        }
      });
    }

    // Step 2 submit
    if (enableForm && !enableForm.__fwBound) {
      enableForm.__fwBound = true;

      enableForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        setStatus(enableForm, "");

        if (!unlocked) {
          setStatus(enableForm, "Complete the test to unlock permanent deliveries.");
          setActiveStep(1);
          return;
        }
        if (step2Ready && !step2Ready.checked) {
          setStatus(enableForm, "Confirm your production endpoint is ready.");
          return;
        }

        disableSubmit(enableForm, true, "Enabling…");

        var companyEl =
          qs("#fw_company", enableForm) ||
          qs('input[name="company"]', enableForm) ||
          qs("#fw_s2_company", enableForm);

        var phoneEl =
          qs("#fw_phone", enableForm) ||
          qs('input[name="phone"]', enableForm) ||
          qs('input[name="cell_phone"]', enableForm);

        var prodEl =
          qs("#fw_prod_endpoint", enableForm) ||
          qs('input[name="endpoint_url"]', enableForm);

        var company = (companyEl && companyEl.value ? companyEl.value : "").trim();
        var phone = (phoneEl && phoneEl.value ? phoneEl.value : "").trim();
        var prod = (prodEl && prodEl.value ? prodEl.value : "").trim();

        var email2 = lastEmail;
        if (!email2) {
          var step1EmailEl = qs("#fw_email", root) || qs('input[name="email"]', root);
          email2 = (step1EmailEl && step1EmailEl.value ? step1EmailEl.value : "").trim();
        }

        try {
          await submitIntegratorRequest("push_access", {
            kind: "push_access",
            email: email2,
            company: company,
            endpoint_url: prod,
            delivery_env: "production",
            notes: phone ? "Ops contact phone: " + phone : "Docs: HTTPS Push Step 2 (enable production).",
            source_path: window.location.pathname,
          });

          setStatus(enableForm, "Submitted. Production delivery is now configured for ongoing publishes.");
        } catch (err) {
          setStatus(enableForm, "Couldn’t submit. Try again.");
        } finally {
          disableSubmit(enableForm, false);
          updateStep2Availability();
        }
      });
    }

    qsa("[data-fw-cancel]", root).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        closeAccordion("pushAccess");
      });
    });
  }

  // ---------- DOM placement fixes (panel directly under its CTA row) ----------

  function movePanelUnderTrigger(key) {
    var id = panelIdFor(key);
    if (!id) return;

    var panel = document.getElementById(id);
    if (!panel) return;

    var trigger = qs('[data-open-accordion="' + key + '"]');
    if (!trigger) return;

    if (trigger.nextElementSibling === panel) return;

    trigger.parentNode.insertBefore(panel, trigger.nextSibling);
  }

  // ---------- Integration form (non-wizard) ----------

  function mountIntegration(panel) {
    var form =
      qs("#fwIntegrationForm", panel) || qs('form[data-fw-kind="integration"]', panel);
    if (!form) return;

    if (form.__fwBound) return;
    form.__fwBound = true;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      setStatus(form, "");
      disableSubmit(form, true, "Sending…");

      var emailEl = qs("#fw_int_email", form) || qs('input[name="email"]', form);
      var companyEl = qs("#fw_int_company", form) || qs('input[name="company"]', form);
      var notesEl = qs("#fw_int_notes", form) || qs('textarea[name="notes"]', form);

      var email = (emailEl && emailEl.value ? emailEl.value : "").trim();
      var company = (companyEl && companyEl.value ? companyEl.value : "").trim();
      var notes = (notesEl && notesEl.value ? notesEl.value : "").trim();

      try {
        await submitIntegratorRequest("integration", {
          kind: "integration",
          email: email,
          company: company,
          notes: notes,
          source_path: window.location.pathname,
        });

        setStatus(form, "Submitted. We’ll follow up shortly.");
        form.reset();
      } catch (err) {
        setStatus(form, "Couldn’t submit. Try again.");
      } finally {
        disableSubmit(form, false);
      }
    });

    qsa('[data-close-accordion="integration"], [data-fw-cancel]', panel).forEach(
      function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          closeAccordion("integration");
        });
      }
    );
  }

  // ---------- Global click handling ----------

  function mount() {
    var push = document.getElementById("pushAccessAccordion");
    var integ = document.getElementById("integrationAccordion");
    if (push && !push.getAttribute("aria-hidden")) push.setAttribute("aria-hidden", "true");
    if (integ && !integ.getAttribute("aria-hidden")) integ.setAttribute("aria-hidden", "true");

    movePanelUnderTrigger("pushAccess");
    movePanelUnderTrigger("integration");

    if (push) mountWizard(push);
    if (integ) mountIntegration(integ);

    document.addEventListener("click", function (e) {
      var open = safeClosest(e.target, "[data-open-accordion]");
      if (open) {
        e.preventDefault();
        openAccordion(open.getAttribute("data-open-accordion"));
        return;
      }

      var close = safeClosest(e.target, "[data-close-accordion]");
      if (close) {
        e.preventDefault();
        closeAccordion(close.getAttribute("data-close-accordion"));
        return;
      }

      var copyBtn = safeClosest(e.target, "[data-copy-target]");
      if (copyBtn) {
        e.preventDefault();
        var target = copyBtn.getAttribute("data-copy-target");

        var v = copyBtn.getAttribute("data-copy-value");

        if (!v) {
          var scope =
            safeClosest(copyBtn, "[data-fw-copy-scope]") ||
            safeClosest(copyBtn, ".formPanel") ||
            document;

          var el = qs('[data-copy-value][data-copy-key="' + target + '"]', scope);
          if (el) v = el.getAttribute("data-copy-value") || el.textContent;
        }

        v = (v || "").trim();
        if (!v) return;

        copyText(v).then(function () {
          var old = copyBtn.textContent;
          copyBtn.textContent = "Copied";
          setTimeout(function () {
            copyBtn.textContent = old;
          }, 900);
        });
        return;
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllAccordions();
    });
  }

  document.addEventListener("DOMContentLoaded", mount);
})();