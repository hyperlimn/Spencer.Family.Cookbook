const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(body, status = 200, origin = "") {
  const headers = { ...JSON_HEADERS };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "family-recipe";
}

function markdownFor(values, slug) {
  const quote = value => JSON.stringify(String(value || "").trim());
  const ingredients = values.ingredients
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => `  - ${quote(item)}`)
    .join("\n");
  const note = values.notes?.trim()
    ? `\n\n## Family note\n\n${values.notes.trim()}`
    : "";
  return `---
title: ${quote(values.title)}
slug: ${quote(slug)}
category: ${quote(values.category)}
contributor: ${quote(values.contributor)}
yield: ${quote(values.yield)}
source_pages: []
pdf_page: null
source_side: null
needs_review: false
date_added: ${quote(new Date().toISOString().slice(0, 10))}
ingredients:
${ingredients}
---

${values.directions.trim()}${note}
`;
}

async function github(env, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "spencer-family-cookbook-worker",
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.message || `GitHub returned ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createRecipePullRequest(env, values) {
  const repoPath = `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const baseSlug = slugify(values.title);
  let slug = baseSlug;
  for (let version = 1; version < 1000; version += 1) {
    const paths = [
      `content/recipes/${slug}.md`,
      `content/new-recipes/${slug}.md`,
    ];
    const results = await Promise.all(paths.map(async path => {
      try {
        await github(env, `${repoPath}/contents/${path}?ref=${env.GITHUB_BRANCH}`);
        return true;
      } catch (error) {
        if (error.status === 404) return false;
        throw error;
      }
    }));
    if (!results.some(Boolean)) break;
    slug = `${baseSlug}-${version + 1}`;
  }
  const filePath = `content/new-recipes/${slug}.md`;

  const base = await github(env, `${repoPath}/git/ref/heads/${env.GITHUB_BRANCH}`);
  const branch = `recipe-submission/${slug}-${Date.now()}`;
  await github(env, `${repoPath}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });

  await github(env, `${repoPath}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Add ${values.title.trim()}`,
      content: btoa(unescape(encodeURIComponent(markdownFor(values, slug)))),
      branch,
    }),
  });

  return github(env, `${repoPath}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Add recipe: ${values.title.trim()}`,
      head: branch,
      base: env.GITHUB_BRANCH,
      body: `Submitted through the cookbook website by ${values.contributor.trim()}.\n\nReview the recipe, then merge this pull request to publish it.`,
    }),
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN.replace(/\/$/, "");
    if (origin !== allowedOrigin) return json({ error: "Origin not allowed." }, 403);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          vary: "Origin",
        },
      });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ error: "Expected JSON." }, 415, origin);
    }

    let values;
    try {
      values = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400, origin);
    }
    if (values.website) return json({ ok: true }, 200, origin);

    const required = ["title", "contributor", "category", "ingredients", "directions"];
    const missing = required.filter(key => typeof values[key] !== "string" || !values[key].trim());
    if (missing.length) return json({ error: `Missing: ${missing.join(", ")}.` }, 422, origin);
    if (JSON.stringify(values).length > 50000) return json({ error: "Submission is too large." }, 413, origin);

    try {
      const pull = await createRecipePullRequest(env, values);
      return json({ ok: true, pull_request: pull.html_url }, 201, origin);
    } catch (error) {
      console.error(error.details || error);
      if (error.status === 401) {
        return json({ error: "GitHub authentication failed. Check the GITHUB_TOKEN secret." }, 502, origin);
      }
      if (error.status === 403) {
        return json({ error: "GitHub denied access. Check the token's repository permissions." }, 502, origin);
      }
      if (error.status === 404) {
        return json({ error: "The configured GitHub repository or branch was not found." }, 502, origin);
      }
      return json({ error: "Could not create the recipe review." }, 502, origin);
    }
  },
};
