#!/usr/bin/env node
// Creates (or updates) the two private accounts, their shared conversation
// and the Bond row. Run from a trusted machine only:
//
//   node --env-file=.env.local scripts/setup-users.mjs
//
// Uses the Supabase secret / service-role key, which bypasses RLS.
// That key must never be exposed to the browser, so this lives outside the app.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value.trim();
}

if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  process.exit(1);
}

const people = [1, 2].map((n) => ({
  email: required(`SETUP_USER_${n}_EMAIL`).toLowerCase(),
  password: required(`SETUP_USER_${n}_PASSWORD`),
  username: required(`SETUP_USER_${n}_USERNAME`).toLowerCase(),
  displayName: required(`SETUP_USER_${n}_DISPLAY_NAME`),
}));

for (const p of people) {
  if (p.password.length < 10) {
    console.error(`Password for ${p.email} must be at least 10 characters.`);
    process.exit(1);
  }
  if (!/^[a-z0-9_]{2,24}$/.test(p.username)) {
    console.error(`Username "${p.username}" must match ^[a-z0-9_]{2,24}$.`);
    process.exit(1);
  }
}

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(p) {
  const existing = await findUserByEmail(p.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: p.password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`✓ updated ${p.email}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: p.password,
    email_confirm: true,
    user_metadata: { username: p.username, display_name: p.displayName },
  });
  if (error) throw error;
  console.log(`✓ created ${p.email}`);
  return data.user.id;
}

async function main() {
  const ids = [];
  for (const p of people) ids.push(await ensureUser(p));

  for (let i = 0; i < people.length; i++) {
    const { error } = await admin
      .from("profiles")
      .update({ username: people[i].username, display_name: people[i].displayName })
      .eq("id", ids[i]);
    if (error) throw error;
  }

  // Reuse the conversation the pair already shares, otherwise create one.
  const { data: memberships, error: mErr } = await admin
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("user_id", ids);
  if (mErr) throw mErr;

  const byConversation = new Map();
  for (const m of memberships) {
    byConversation.set(m.conversation_id, [...(byConversation.get(m.conversation_id) ?? []), m.user_id]);
  }
  let conversationId = [...byConversation].find(([, users]) => users.length === 2)?.[0];

  if (!conversationId) {
    const { data: conv, error } = await admin.from("conversations").insert({}).select("id").single();
    if (error) throw error;
    conversationId = conv.id;
    const { error: insErr } = await admin
      .from("conversation_members")
      .insert(ids.map((user_id) => ({ conversation_id: conversationId, user_id })));
    if (insErr) throw insErr;
    console.log(`✓ created conversation ${conversationId}`);
  } else {
    console.log(`✓ conversation ${conversationId} already exists`);
  }

  const { error: bondErr } = await admin
    .from("bond")
    .upsert({ conversation_id: conversationId }, { onConflict: "conversation_id", ignoreDuplicates: true });
  if (bondErr) throw bondErr;

  console.log("\nDone. Both accounts can now sign in.");
}

main().catch((err) => {
  console.error("Setup failed:", err.message ?? err);
  process.exit(1);
});
