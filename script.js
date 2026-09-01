document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      links.classList.toggle("open");
    });
  }

  const form = document.querySelector("#quoteForm");

  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');

  let statusBox = document.querySelector("#quoteStatus");

  if (!statusBox) {
    statusBox = document.createElement("div");
    statusBox.id = "quoteStatus";
    statusBox.className = "full small";
    statusBox.setAttribute("role", "status");
    statusBox.setAttribute("aria-live", "polite");

    const buttonContainer = submitButton?.parentElement;

    if (buttonContainer) {
      buttonContainer.insertAdjacentElement("afterend", statusBox);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);

    const payload = {
      name: formData.get("name") || "",
      company: formData.get("company") || "",
      email: formData.get("email") || "",
      phone: formData.get("phone") || "",
      service: formData.get("service") || "",
      budget: formData.get("budget") || "",
      message: formData.get("message") || ""
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    statusBox.className = "full small muted";
    statusBox.textContent = "Sending your project inquiry...";

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || "Unable to submit your inquiry."
        );
      }

      form.reset();

      statusBox.className = "full small";
      statusBox.innerHTML = `
        <strong>Thank you — your inquiry has been received.</strong><br>
        Your MDV reference is:
        <strong>${escapeHtml(result.reference)}</strong><br>
        We will review your request and contact you regarding the next step.
      `;

    } catch (error) {
      console.error("MDV inquiry error:", error);

      statusBox.className = "full small";
      statusBox.innerHTML = `
        <strong>We could not submit your inquiry right now.</strong><br>
        Please try again or email
        <a href="mailto:makdigitalventures@gmail.com">
          makdigitalventures@gmail.com
        </a>.
      `;
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send Project Inquiry →";
      }
    }
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
