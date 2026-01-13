(function () {
  function setActiveNav() {
    var path = window.location.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    if (path.endsWith("/index.html")) path = path.slice(0, -("/index.html".length));

    document.querySelectorAll(".nav a").forEach(function (a) {
      a.classList.remove("active");
      var href = a.getAttribute("href") || "";
      try {
        var u = new URL(href, window.location.origin);
        var hp = u.pathname;
        if (hp.length > 1 && hp.endsWith("/")) hp = hp.slice(0, -1);
        if (hp.endsWith("/index.html")) hp = hp.slice(0, -("/index.html".length));
        if (hp === path) a.classList.add("active");
      } catch (e) {}
    });
  }

  function mobileNav() {
    var btn = document.querySelector("[data-nav-toggle]");
    var sidebar = document.querySelector(".sidebar");
    var scrim = document.querySelector(".scrim");
    if (!btn || !sidebar || !scrim) return;

    function close() {
      sidebar.classList.remove("open");
      scrim.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
    }
    function open() {
      sidebar.classList.add("open");
      scrim.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
    }

    btn.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) close();
      else open();
    });

    scrim.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", close);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) close();
    });
  }

  // Optional: panel open/close (only if your HTML uses it)
  function mountPanels() {
    document.querySelectorAll("[data-open-panel]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var key = btn.getAttribute("data-open-panel");
        var panel = document.querySelector('[data-panel="' + key + '"]');
        if (!panel) return;
        panel.setAttribute("aria-hidden", "false");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelectorAll("[data-close-panel]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var key = btn.getAttribute("data-close-panel");
        var panel = document.querySelector('[data-panel="' + key + '"]');
        if (!panel) return;
        panel.setAttribute("aria-hidden", "true");
      });
    });
  }

  async function submitIntegratorRequest(kind, formEl) {
    var fd = new FormData(formEl);
    var payload = {
      kind: kind,
      email: (fd.get("email") || "").toString(),
      company: (fd.get("company") || "").toString(),
      name: (fd.get("name") || "").toString(),
      role: (fd.get("role") || "").toString(),
      endpoint_url: (fd.get("endpoint_url") || "").toString(),
      delivery_env: (fd.get("delivery_env") || "").toString(),
      format_preference: (fd.get("format_preference") || "").toString(),
      notes: (fd.get("notes") || "").toString(),
      source_path: window.location.pathname,
    };

    var res = await fetch("/api/integrator-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    var json = await res.json().catch(function () { return {}; });
    if (!res.ok || !json.ok) throw new Error(json.error || "submit_failed");
    return json.id;
  }

  function mountForms() {
    document.querySelectorAll("form[data-fw-kind]").forEach(function (form) {
      if (form.__fwBound) return;
      form.__fwBound = true;

      var kind = form.getAttribute("data-fw-kind");
      var statusEl = form.querySelector("[data-fw-status]");
      var btn = form.querySelector('button[type="submit"]');

      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        if (statusEl) statusEl.textContent = "";
        if (btn) {
          btn.disabled = true;
          btn.dataset.fwOldText = btn.textContent || "";
          btn.textContent = "Submitting…";
        }

        try {
          await submitIntegratorRequest(kind, form);
          if (statusEl) statusEl.textContent = "Submitted. We’ll follow up shortly.";
          form.reset();
        } catch (err) {
          if (statusEl) statusEl.textContent = "Couldn’t submit. Try again.";
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = btn.dataset.fwOldText || "Submit";
          }
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveNav();
    mobileNav();
    mountPanels();
    mountForms();
  });
})();
