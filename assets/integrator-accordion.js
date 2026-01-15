/* assets/integrator-accordion.js */

/*
  Integrator accordion + HTTPS Push wizard
  - Step 1: test delivery (push_access + delivery_env=test) and show immediate status
  - Step 2: enable ongoing delivery (push_access + delivery_env=production)
  - Integration form: simple "integration" request capture

  UI improvements in this version:
  - Both Step 1 + Step 2 panes are visible on load (no blank space).
  - Step 2 is visibly "locked" until Step 1 succeeds.
  - Step 1 supports "Resend test" (re-run test delivery as many times as needed).
  - No hard dependency on HTML having a resend button; we inject one if missing.
*/

console.log("FW_DEBUG_LOADED integrator-accordion.js", window.location.pathname);

// ---------------- Base URL override (meta-driven) ----------------
// - Default: same-origin (""), good for Vercel.
// - If on Cloudflare Pages (*.pages.dev), default API base to Vercel because /api lives there.
// - Or explicitly set <meta name="fw-base" content="https://fundamentals-dev-docs.vercel.app" />

const FW_BASE_META = document.querySelector('meta[name="fw-base"]');

let FW_API_BASE =
  (FW_BASE_META && (FW_BASE_META.getAttribute("content") || "").trim()) || "";

try {
  const host = String(window.location.hostname || "");
  if (!FW_API_BASE && host.endsWith("pages.dev")) {
    FW_API_BASE = "https://fundamentals-dev-docs.vercel.app";
  }
} catch {}

function fwApiUrl(pathname) {
  const p = String(pathname || "").startsWith("/")
    ? String(pathname || "")
    : "/" + String(pathname || "");
  return (FW_API_BASE ? FW_API_BASE.replace(/\/+$/, "") : "") + p;
}

// ---------------- main bundle ----------------
(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function safeClosest(el, sel) {
    if (!el) return null;
    if (el.closest) return el.closest(sel);
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

    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

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

  async function submitIntegratorRequest(_kind, payload) {
    var url = fwApiUrl("/api/integrator-request");

    var res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    var json = await res.json().catch(function () {
      return {};
    });

    if (!res.ok || !json.ok) throw new Error(json.error || "submit_failed");
    return json;
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

  // ---------- Wizard helpers (HTTPS Push) ----------

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

    var step2Lock =
      qs("[data-fw-step2-lock]", root) || qs("#fwStep2Locked", root);
    var step2Submit =
      qs("#fwEnableBtn", root) || qs('[data-fw-step2-submit]', root);
    var step2Ready =
      qs("#fw_ready", root) || qs('[data-fw-step2-ready]', root);

    var testForm = qs("#fwTestForm", root) || qs('[data-fw-step1-form]', root);
    var enableForm =
      qs("#fwEnableForm", root) || qs('[data-fw-step2-form]', root);

    var lastEmail = "";
    var unlocked = false;

    // Visually + functionally disable Step 2 fields when locked.
    function setStep2Disabled(disabled) {
      if (!step2View) return;

      // If you have CSS keyed off this, it’s useful.
      root.setAttribute("data-fw-unlocked", disabled ? "false" : "true");

      // Disable all interactive controls in step 2 (except Close/Cancel buttons if present).
      var controls = qsa(
        'input, textarea, select, button',
        step2View
      ).filter(function (el) {
        // allow buttons explicitly tagged as cancel/close
        if (matches(el, "[data-fw-cancel]")) return false;
        if (matches(el, '[data-close-accordion="pushAccess"]')) return false;
        return true;
      });

      controls.forEach(function (el) {
        try {
          el.disabled = !!disabled;
        } catch (e) {}
      });

      // Ensure primary submit follows the same rule
      if (step2Submit) {
        try {
          step2Submit.disabled = !!disabled;
        } catch (e) {}
      }
    }

    function setActiveStep(n) {
      // NEW behavior: always render both panes to avoid blank space.
      if (step1View) step1View.style.display = "";
      if (step2View) step2View.style.display = "";

      if (step1Item)
        step1Item.setAttribute("data-active", n === 1 ? "true" : "false");
      if (step2Item)
        step2Item.setAttribute("data-active", n === 2 ? "true" : "false");

      if (step1Item)
        step1Item.setAttribute("aria-current", n === 1 ? "step" : "false");
      if (step2Item)
        step2Item.setAttribute("aria-current", n === 2 ? "step" : "false");

      // If user tries to switch to step 2 while locked, keep them on step 1.
      if (n === 2 && !unlocked) {
        if (testForm)
          setStatus(testForm, "Run the test to unlock ongoing deliveries.");
        n = 1;
        if (step1Item)
          step1Item.setAttribute("data-active", "true");
        if (step2Item)
          step2Item.setAttribute("data-active", "false");
      }

      // Focus first input in the requested view.
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
      // NEW: if the readiness checkbox is missing, allow submit once unlocked.
      var ok = unlocked && (!step2Ready || step2Ready.checked);
      if (step2Submit) step2Submit.disabled = !ok;
    }

    function setUnlocked(v) {
      unlocked = !!v;

      // lock message visibility
      if (step2Lock) step2Lock.style.display = unlocked ? "none" : "";

      if (step2Item)
        step2Item.setAttribute("data-locked", unlocked ? "false" : "true");

      setStep2Disabled(!unlocked);
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
        setActiveStep(2);
      });
    }

    if (step2Ready) step2Ready.addEventListener("change", updateStep2Availability);

    // ---------------- Step 1: add resend support ----------------

    function ensureResendButton() {
      if (!testForm) return null;

      // If the markup already has it, use it.
      var btn = qs("#fwResendTest", testForm);
      if (btn) return btn;

      // Otherwise inject a secondary button next to the submit button.
      var submitBtn = qs('button[type="submit"]', testForm);
      if (!submitBtn) return null;

      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "fwResendTest";
      btn.textContent = "Resend test";
      btn.style.marginLeft = "10px";
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";

      // Keep it visually secondary without requiring global CSS changes.
      btn.style.padding = submitBtn.style.padding || "";
      btn.style.borderRadius = submitBtn.style.borderRadius || "";
      btn.style.border = "1px solid var(--border, #e2e8f0)";
      btn.style.background = "#fff";
      btn.style.color = "inherit";
      btn.style.cursor = "pointer";

      // Hide until first attempt (per your UX request).
      btn.hidden = true;

      submitBtn.parentNode.insertBefore(btn, submitBtn.nextSibling);
      return btn;
    }

    var resendBtn = ensureResendButton();

    async function runTestDelivery() {
      if (!testForm) return;

      setStatus(testForm, "");
      disableSubmit(testForm, true, "Sending…");
      if (resendBtn) resendBtn.disabled = true;

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

        // After the first attempt, reveal resend.
        if (resendBtn) resendBtn.hidden = false;

        // If backend returns delivery status, show it immediately.
        if (out && out.attempted) {
          if (out.delivered) {
            setStatus(
              testForm,
              "Test delivery succeeded (HTTP " +
                out.http_status +
                "). Step 2 is unlocked."
            );
            setUnlocked(true);
            setActiveStep(2);
          } else {
            setStatus(
              testForm,
              "Test delivery failed. Fix your endpoint and click Resend test."
            );
            setUnlocked(false);
            setActiveStep(1);
          }
        } else {
          // If backend doesn’t return delivery info, keep it simple.
          setStatus(testForm, "Submitted. Test delivery is being sent now.");
          // Don’t unlock unless we know it succeeded.
          setUnlocked(false);
          setActiveStep(1);
        }
      } catch (err) {
        if (resendBtn) resendBtn.hidden = false;
        setUnlocked(false);
        setStatus(testForm, "Couldn’t submit. Check inputs and resend.");
        setActiveStep(1);
      } finally {
        disableSubmit(testForm, false);
        if (resendBtn) resendBtn.disabled = false;
        updateStep2Availability();
      }
    }

    // Step 1 submit handler
    if (testForm && !testForm.__fwBound) {
      testForm.__fwBound = true;

      testForm.addEventListener("submit", function (e) {
        e.preventDefault();
        runTestDelivery();
      });
    }

    // Resend handler
    if (resendBtn && !resendBtn.__fwBound) {
      resendBtn.__fwBound = true;
      resendBtn.addEventListener("click", function (e) {
        e.preventDefault();
        runTestDelivery();
      });
    }

    // ---------------- Step 2 submit (enable ongoing) ----------------

    if (enableForm && !enableForm.__fwBound) {
      enableForm.__fwBound = true;

      enableForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        setStatus(enableForm, "");

        if (!unlocked) {
          setStatus(enableForm, "Complete the test to unlock ongoing deliveries.");
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

        // Optional: public domain field (if present in HTML)
        var domainEl =
          qs("#fw_domain", enableForm) ||
          qs('input[name="public_domain"]', enableForm) ||
          qs('input[name="domain"]', enableForm);

        var company = (companyEl && companyEl.value ? companyEl.value : "").trim();
        var phone = (phoneEl && phoneEl.value ? phoneEl.value : "").trim();
        var prod = (prodEl && prodEl.value ? prodEl.value : "").trim();
        var publicDomain =
          (domainEl && domainEl.value ? domainEl.value : "").trim();

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
            // Keep notes backward-compatible; include extras safely.
            notes:
              (phone ? "Ops contact phone: " + phone + ". " : "") +
              (publicDomain ? "Public domain: " + publicDomain + ". " : "") +
              "Docs: HTTPS Push Step 2 (enable production).",
            source_path: window.location.pathname,
          });

          setStatus(
            enableForm,
            "Submitted. Production delivery is now configured for ongoing publishes."
          );
        } catch (err) {
          setStatus(enableForm, "Couldn’t submit. Try again.");
        } finally {
          disableSubmit(enableForm, false);
          updateStep2Availability();
        }
      });
    }

    // Cancel buttons close the accordion
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

    if (push && !push.getAttribute("aria-hidden"))
      push.setAttribute("aria-hidden", "true");
    if (integ && !integ.getAttribute("aria-hidden"))
      integ.setAttribute("aria-hidden", "true");

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