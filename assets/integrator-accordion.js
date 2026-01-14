// assets/integrator-accordion.js
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

  async function submitIntegratorRequest(kind, payload) {
    var res = await fetch("/api/integrator-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    var json = await res.json().catch(function () {
      return {};
    });

    if (!res.ok || !json.ok) throw new Error(json.error || "submit_failed");
    return json.id;
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
    // We support either:
    // - data-fw-wizard root (recommended), or
    // - fallback to panel itself
    var root = qs("[data-fw-wizard]", panel) || panel;

    // Optional rail support (if you later add a left rail). Safe if absent.
    var rail = qs("[data-fw-rail]", root);

    var step1View =
      qs('[data-fw-step-view="1"]', root) || qs("[data-fw-step1]", root);
    var step2View =
      qs('[data-fw-step-view="2"]', root) || qs("[data-fw-step2]", root);

    // If markup isn’t wizard-style, bail (still keep accordion open/close + integration form).
    if (!step1View && !step2View) return;

    var step1Item = rail ? qs('[data-fw-rail-item="1"]', rail) : null;
    var step2Item = rail ? qs('[data-fw-rail-item="2"]', rail) : null;

    // Step badges (action text INSIDE badge)
    var badge1 = qs('[data-fw-badge="1"]', root);
    var badge2 = qs('[data-fw-badge="2"]', root);

    // Lock/Unlock UI for step 2
    var step2Lock = qs("[data-fw-step2-lock]", root) || qs("#fwStep2Locked", root);
    var step2Submit = qs("#fwEnableBtn", root) || qs('[data-fw-step2-submit]', root);
    var step2Ready = qs("#fw_ready", root) || qs('[data-fw-step2-ready]', root);

    // Forms
    var testForm = qs("#fwTestForm", root) || qs('[data-fw-step1-form]', root);
    var enableForm = qs("#fwEnableForm", root) || qs('[data-fw-step2-form]', root);

    var unlocked = false;

    function setActiveStep(n) {
      // Hide/show views
      if (step1View) step1View.style.display = n === 1 ? "" : "none";
      if (step2View) step2View.style.display = n === 2 ? "" : "none";

      // Rail state (if present)
      if (step1Item) step1Item.setAttribute("data-active", n === 1 ? "true" : "false");
      if (step2Item) step2Item.setAttribute("data-active", n === 2 ? "true" : "false");
      if (step1Item) step1Item.setAttribute("aria-current", n === 1 ? "step" : "false");
      if (step2Item) step2Item.setAttribute("aria-current", n === 2 ? "step" : "false");

      // Focus first input in active view
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

    // Badge text inside the badge
    if (badge1) badge1.textContent = "Test delivery";
    if (badge2) badge2.textContent = "Enable ongoing";

    // Default: Step 1 active; Step 2 locked
    setUnlocked(false);
    setActiveStep(1);

    // Rail click behavior (only allow step 2 if unlocked)
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

        try {
          await submitIntegratorRequest("push_test", {
            kind: "push_test",
            email: email,
            endpoint_url: endpoint,
            source_path: window.location.pathname,
          });

          setStatus(testForm, "Test queued. Expect delivery within ~1–2 minutes.");
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

        try {
          await submitIntegratorRequest("push_enable", {
            kind: "push_enable",
            company: company,
            phone: phone,
            endpoint_url: prod,
            source_path: window.location.pathname,
          });

          setStatus(enableForm, "Enabled. Your production endpoint is configured for ongoing deliveries.");
        } catch (err) {
          setStatus(enableForm, "Couldn’t submit. Try again.");
        } finally {
          disableSubmit(enableForm, false);
          updateStep2Availability();
        }
      });
    }

    // Cancel buttons inside wizard (if you add any with data-fw-cancel) should close the accordion
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

    // If already right after the trigger, do nothing
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

    // Cancel/close should close
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
    // Defensive: keep panels hidden by default (CSS should also do this)
    var push = document.getElementById("pushAccessAccordion");
    var integ = document.getElementById("integrationAccordion");
    if (push && !push.getAttribute("aria-hidden")) push.setAttribute("aria-hidden", "true");
    if (integ && !integ.getAttribute("aria-hidden")) integ.setAttribute("aria-hidden", "true");

    // Fix placement so the panel appears directly under its CTA row
    movePanelUnderTrigger("pushAccess");
    movePanelUnderTrigger("integration");

    // Mount wizard + integration
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

      // Copy buttons: require explicit data-copy-target and read value from data-copy-value
      var copyBtn = safeClosest(e.target, "[data-copy-target]");
      if (copyBtn) {
        e.preventDefault();
        var target = copyBtn.getAttribute("data-copy-target");

        // Preferred: value on the button
        var v = copyBtn.getAttribute("data-copy-value");

        // Fallback: find a nearby element with matching data-copy-key
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