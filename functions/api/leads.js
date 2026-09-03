function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

function clean(value, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createReference() {
  const now = new Date();
  const year = now.getUTCFullYear();

  const timestamp = now
    .toISOString()
    .replace(/\D/g, "")
    .slice(4, 14);

  const random = crypto.randomUUID()
    .slice(0, 4)
    .toUpperCase();

  return `MDV-${year}-${timestamp}-${random}`;
}

async function sendEmail(env, payload) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    throw new Error("Resend email configuration is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      ...payload
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Resend email failed (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.DB) {
      return json({
        ok: false,
        error: "Database connection is not configured."
      }, 500);
    }

    const data = await request.json();

    const name = clean(data.name, 120);
    const company = clean(data.company, 160);
    const email = clean(data.email, 200).toLowerCase();
    const phone = clean(data.phone, 80);
    const service = clean(data.service, 120);
    const budget = clean(data.budget, 80);
    const message = clean(data.message, 5000);

    if (!name || !email || !message) {
      return json({
        ok: false,
        error: "Name, email and project details are required."
      }, 400);
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return json({
        ok: false,
        error: "Please enter a valid email address."
      }, 400);
    }

    const reference = createReference();
    const createdAt = new Date().toISOString();

    // STEP 1 — Save the lead first.
    // Email failure must never cause us to lose the inquiry.
    await env.DB
      .prepare(`
        INSERT INTO leads (
          reference,
          name,
          company,
          email,
          phone,
          service,
          budget,
          message,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
      `)
      .bind(
        reference,
        name,
        company,
        email,
        phone,
        service,
        budget,
        message,
        createdAt
      )
      .run();

    // STEP 2 — Send emails after the lead is safely stored.
    try {
      const safeName = escapeHtml(name);
      const safeCompany = escapeHtml(company || "Not provided");
      const safeEmail = escapeHtml(email);
      const safePhone = escapeHtml(phone || "Not provided");
      const safeService = escapeHtml(service || "Not specified");
      const safeBudget = escapeHtml(budget || "Not specified");
      const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

      // Notify MDV
      if (env.MDV_NOTIFY_EMAIL) {
        await sendEmail(env, {
          to: [env.MDV_NOTIFY_EMAIL],
          reply_to: email,
          subject: `New MDV Project Inquiry — ${reference}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#172033;">
              <h2>New MDV Project Inquiry</h2>

              <p>
                A new project inquiry has been submitted through
                makdigitalventures.com.
              </p>

              <p>
                <strong>Reference:</strong> ${reference}
              </p>

              <hr>

              <p><strong>Name:</strong> ${safeName}</p>
              <p><strong>Company:</strong> ${safeCompany}</p>
              <p><strong>Email:</strong> ${safeEmail}</p>
              <p><strong>Phone / WhatsApp:</strong> ${safePhone}</p>
              <p><strong>Service:</strong> ${safeService}</p>
              <p><strong>Budget:</strong> ${safeBudget}</p>

              <p><strong>Project details:</strong></p>

              <div style="padding:15px;background:#f5f7fa;border-radius:8px;">
                ${safeMessage}
              </div>

              <p style="margin-top:25px;color:#667085;font-size:13px;">
                This lead has already been saved to the MDV lead database.
              </p>
            </div>
          `
        });
      }

      // Confirmation to customer
      await sendEmail(env, {
        to: [email],
        reply_to: env.MDV_NOTIFY_EMAIL || undefined,
        subject: `We received your MDV project inquiry — ${reference}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#172033;line-height:1.6;">

            <h2>Thank you for contacting Mak Digital Ventures.</h2>

            <p>Hello ${safeName},</p>

            <p>
              We have received your project inquiry and will review
              the information you submitted.
            </p>

            <div style="padding:18px;background:#f5f7fa;border-radius:8px;margin:20px 0;">
              <strong>Your MDV reference:</strong><br>
              <span style="font-size:20px;">
                ${reference}
              </span>
            </div>

            <p>
              Our team will contact you regarding the next step.
              Please keep this reference for your records.
            </p>

            <p>
              <strong>Service requested:</strong>
              ${safeService}
            </p>

            <p>
              Thank you for considering Mak Digital Ventures.
            </p>

            <p>
              <strong>Mak Digital Ventures</strong><br>
              AI & Digital Solutions<br>
              makdigitalventures.com
            </p>

          </div>
        `
      });

    } catch (emailError) {
      // Lead is already safely stored.
      // Log email failure without turning the inquiry into a failed submission.
      console.error(
        "MDV lead saved, but email notification failed:",
        emailError
      );
    }

    return json({
      ok: true,
      reference,
      message: "Project inquiry received."
    }, 201);

  } catch (error) {
    console.error("MDV lead submission error:", error);

    return json({
      ok: false,
      error: "Unable to submit inquiry right now."
    }, 500);
  }
}

export function onRequestGet() {
  return json({
    ok: false,
    error: "Method not allowed."
  }, 405);
}
