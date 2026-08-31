
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  const form = document.querySelector("#quoteForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const subject = encodeURIComponent("MDV Project Inquiry - " + (data.get("company") || data.get("name") || "New Lead"));
      const body = encodeURIComponent(
        "Name: " + (data.get("name") || "") + "\n" +
        "Company: " + (data.get("company") || "") + "\n" +
        "Email: " + (data.get("email") || "") + "\n" +
        "Phone/WhatsApp: " + (data.get("phone") || "") + "\n" +
        "Service: " + (data.get("service") || "") + "\n" +
        "Budget: " + (data.get("budget") || "") + "\n\n" +
        "Project details:\n" + (data.get("message") || "")
      );
      window.location.href = "mailto:makdigitalventures@gmail.com?subject=" + subject + "&body=" + body;
    });
  }
});
