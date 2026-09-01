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

    return json({
      ok: true,
      reference: reference,
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
