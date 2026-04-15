/**
 * DealerCRM — Embeddable Lead Capture Form
 *
 * Usage: Add to any website's <head> or <body>:
 *   <script
 *     src="https://yourdomain.com/embed/dealercrm-form.js"
 *     data-company-id="YOUR_COMPANY_UUID"
 *     data-webhook-url="https://your-n8n.com/webhook/form-intake"
 *   ></script>
 *
 * The script renders a shadow-DOM form wherever the <script> tag is placed.
 * Styles are fully isolated from the host page.
 */
(function () {
  "use strict";

  // Capture script reference synchronously (before any async runs)
  const currentScript = document.currentScript;
  if (!currentScript) {
    console.error("[DealerCRM] Cannot find script element. Ensure the script is loaded synchronously (no async/defer).");
    return;
  }

  const companyId = currentScript.getAttribute("data-company-id") || "";
  const webhookUrl = currentScript.getAttribute("data-webhook-url") || "";

  if (!webhookUrl) {
    console.error("[DealerCRM] Missing data-webhook-url attribute on script tag.");
    return;
  }

  // Create host container + shadow root
  const host = document.createElement("div");
  host.id = "dealercrm-form-host";
  currentScript.parentNode.insertBefore(host, currentScript.nextSibling);

  const shadow = host.attachShadow({ mode: "open" });

  // ── Styles ──────────────────────────────────────────────────────────
  const styles = `
    :host { display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .dcf-form { max-width: 460px; margin: 0 auto; padding: 28px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; }
    .dcf-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .dcf-subtitle { font-size: 14px; color: #64748b; margin-bottom: 20px; }

    .dcf-row { display: flex; gap: 12px; }
    .dcf-field { display: flex; flex-direction: column; margin-bottom: 14px; flex: 1; }
    .dcf-label { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
    .dcf-required::after { content: " *"; color: #ef4444; }

    .dcf-input, .dcf-textarea {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 14px; color: #0f172a; background: #f8fafc; transition: border-color 0.15s;
    }
    .dcf-input:focus, .dcf-textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .dcf-input::placeholder, .dcf-textarea::placeholder { color: #94a3b8; }
    .dcf-textarea { min-height: 80px; resize: vertical; }

    .dcf-btn {
      width: 100%; padding: 12px; border: none; border-radius: 8px; cursor: pointer;
      font-size: 15px; font-weight: 600; color: #fff; background: #2563eb; margin-top: 4px;
      transition: background 0.15s;
    }
    .dcf-btn:hover { background: #1d4ed8; }
    .dcf-btn:disabled { background: #94a3b8; cursor: not-allowed; }

    .dcf-error { color: #ef4444; font-size: 13px; margin-top: 8px; text-align: center; }

    .dcf-success {
      text-align: center; padding: 40px 20px;
    }
    .dcf-success-icon { font-size: 48px; margin-bottom: 12px; }
    .dcf-success-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .dcf-success-text { font-size: 14px; color: #64748b; }
  `;

  // ── HTML ────────────────────────────────────────────────────────────
  const formHTML = `
    <style>${styles}</style>
    <div class="dcf-form" id="dcf-container">
      <div class="dcf-title">Get in Touch</div>
      <div class="dcf-subtitle">Fill out the form below and we'll get back to you right away.</div>
      <form id="dcf-lead-form" novalidate>
        <div class="dcf-row">
          <div class="dcf-field">
            <label class="dcf-label dcf-required" for="dcf-first">First Name</label>
            <input class="dcf-input" id="dcf-first" name="first_name" type="text" placeholder="John" required />
          </div>
          <div class="dcf-field">
            <label class="dcf-label" for="dcf-last">Last Name</label>
            <input class="dcf-input" id="dcf-last" name="last_name" type="text" placeholder="Smith" />
          </div>
        </div>
        <div class="dcf-field">
          <label class="dcf-label dcf-required" for="dcf-phone">Phone</label>
          <input class="dcf-input" id="dcf-phone" name="phone" type="tel" placeholder="(514) 555-0123" required />
        </div>
        <div class="dcf-field">
          <label class="dcf-label dcf-required" for="dcf-email">Email</label>
          <input class="dcf-input" id="dcf-email" name="email" type="email" placeholder="john@example.com" required />
        </div>
        <div class="dcf-field">
          <label class="dcf-label" for="dcf-vehicle">Vehicle of Interest</label>
          <input class="dcf-input" id="dcf-vehicle" name="vehicle_interest" type="text" placeholder="e.g. 2024 Toyota Camry" />
        </div>
        <div class="dcf-field">
          <label class="dcf-label" for="dcf-message">Message</label>
          <textarea class="dcf-textarea" id="dcf-message" name="message" placeholder="Any additional details..."></textarea>
        </div>
        <button class="dcf-btn" type="submit">Submit Inquiry</button>
        <div class="dcf-error" id="dcf-error" style="display:none;"></div>
      </form>
    </div>
  `;

  shadow.innerHTML = formHTML;

  // ── Logic ───────────────────────────────────────────────────────────
  const form = shadow.getElementById("dcf-lead-form");
  const container = shadow.getElementById("dcf-container");
  const errorEl = shadow.getElementById("dcf-error");

  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return "+1" + digits;
    if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
    return "+" + digits;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function clearError() {
    errorEl.style.display = "none";
  }

  function showSuccess() {
    container.innerHTML = `
      <div class="dcf-success">
        <div class="dcf-success-icon">&#10003;</div>
        <div class="dcf-success-title">Thank You!</div>
        <div class="dcf-success-text">We've received your inquiry and will be in touch shortly.</div>
      </div>
    `;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError();

    const data = new FormData(form);
    const firstName = (data.get("first_name") || "").trim();
    const phone = (data.get("phone") || "").trim();
    const email = (data.get("email") || "").trim();

    // Client-side validation
    if (!firstName) { showError("First name is required."); return; }
    if (!phone) { showError("Phone number is required."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError("Please enter a valid email address."); return; }

    const btn = form.querySelector(".dcf-btn");
    btn.disabled = true;
    btn.textContent = "Submitting...";

    const payload = {
      first_name: firstName,
      last_name: (data.get("last_name") || "").trim(),
      phone: normalizePhone(phone),
      email: email,
      vehicle_interest: (data.get("vehicle_interest") || "").trim(),
      message: (data.get("message") || "").trim(),
      company_id: companyId,
      source: "website_form",
    };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Server error");
      }

      showSuccess();
    } catch (err) {
      console.error("[DealerCRM] Form submission error:", err);
      showError("Something went wrong. Please try again.");
      btn.disabled = false;
      btn.textContent = "Submit Inquiry";
    }
  });
})();
