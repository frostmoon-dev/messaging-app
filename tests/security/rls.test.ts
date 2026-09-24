/**
 * Attacks the real database policies with real sessions.
 * Needs a running Supabase (local or a disposable project) and
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY in the environment:
 *
 *   npm run test:security
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const enabled = Boolean(url && publishable && secret);

type Client = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("row level security", () => {
  const admin = enabled ? createClient<Database>(url!, secret!, opts) : (null as unknown as Client);
  const users: Record<"a" | "b" | "outsider", { id: string; client: Client }> = {} as never;
  let conversationId = "";
  let messageId = "";
  let imagePath = "";

  async function makeUser(tag: string) {
    const email = `rls-${tag}-${randomUUID().slice(0, 8)}@test.local`;
    const password = randomBytes(12).toString("hex");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient<Database>(url!, publishable!, opts);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    users.a = await makeUser("a");
    users.b = await makeUser("b");
    users.outsider = await makeUser("x");

    const { data: conv, error } = await admin.from("conversations").insert({}).select("id").single();
    if (error) throw error;
    conversationId = conv.id;
    const { error: mErr } = await admin.from("conversation_members").insert([
      { conversation_id: conversationId, user_id: users.a.id },
      { conversation_id: conversationId, user_id: users.b.id },
    ]);
    if (mErr) throw mErr;
    await admin.from("bond").insert({ conversation_id: conversationId });

    const { data: msg, error: msgErr } = await users.a.client
      .from("messages")
      .insert({ conversation_id: conversationId, content: "secret hello" })
      .select("id")
      .single();
    if (msgErr) throw msgErr;
    messageId = msg.id;

    imagePath = `${conversationId}/${randomUUID()}.png`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const { error: upErr } = await users.a.client.storage.from("chat-images").upload(imagePath, png, { contentType: "image/png" });
    if (upErr) throw upErr;
  });

  afterAll(async () => {
    if (!enabled) return;
    await admin.storage.from("chat-images").remove([imagePath]);
    if (conversationId) await admin.from("conversations").delete().eq("id", conversationId);
    for (const u of Object.values(users)) if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("members can read their messages", async () => {
    const { data } = await users.b.client.from("messages").select("id, content").eq("id", messageId);
    expect(data?.[0]?.content).toBe("secret hello");
  });

  it("outsiders see nothing", async () => {
    const c = users.outsider.client;
    const results = await Promise.all([
      c.from("messages").select("id").eq("conversation_id", conversationId),
      c.from("conversations").select("id").eq("id", conversationId),
      c.from("conversation_members").select("user_id").eq("conversation_id", conversationId),
      c.from("bond").select("level").eq("conversation_id", conversationId),
      c.from("memories").select("id").eq("conversation_id", conversationId),
    ]);
    for (const { data } of results) expect(data ?? []).toHaveLength(0);
    const { data: profiles } = await c.from("profiles").select("id").in("id", [users.a.id, users.b.id]);
    expect(profiles ?? []).toHaveLength(0);
  });

  it("anonymous requests see nothing", async () => {
    const anon = createClient<Database>(url!, publishable!, opts);
    const { data: msgs } = await anon.from("messages").select("id");
    expect(msgs ?? []).toHaveLength(0);
    const { data: profiles } = await anon.from("profiles").select("id");
    expect(profiles ?? []).toHaveLength(0);
  });

  it("public sign-up is disabled", async () => {
    const anon = createClient<Database>(url!, publishable!, opts);
    const { data, error } = await anon.auth.signUp({
      email: `stranger-${randomUUID().slice(0, 8)}@test.local`,
      password: randomBytes(12).toString("hex"),
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("outsiders cannot post into the conversation", async () => {
    const { error } = await users.outsider.client
      .from("messages")
      .insert({ conversation_id: conversationId, content: "let me in" });
    expect(error).not.toBeNull();
  });

  it("outsiders cannot add themselves as a member", async () => {
    const { error } = await users.outsider.client
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: users.outsider.id });
    expect(error).not.toBeNull();
  });

  it("members cannot impersonate the other person", async () => {
    const { data } = await users.a.client
      .from("messages")
      .insert({ conversation_id: conversationId, content: "spoof", sender_id: users.b.id } as never)
      .select("sender_id")
      .single();
    // Either rejected, or sender forced back to the real author.
    if (data) expect(data.sender_id).toBe(users.a.id);
  });

  it("members cannot edit message content or forge receipts directly", async () => {
    const { error } = await users.b.client.from("messages").update({ content: "edited" }).eq("id", messageId);
    expect(error).not.toBeNull();
    const { error: receiptErr } = await users.a.client
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId);
    expect(receiptErr).not.toBeNull();
  });

  it("receipts only move through the RPC and only for the recipient", async () => {
    await users.a.client.rpc("mark_messages_read", { conv: conversationId });
    const { data: stillUnread } = await admin.from("messages").select("read_at").eq("id", messageId).single();
    expect(stillUnread?.read_at).toBeNull();

    const { error } = await users.b.client.rpc("mark_messages_read", { conv: conversationId });
    expect(error).toBeNull();
    const { data: read } = await admin.from("messages").select("read_at, delivered_at").eq("id", messageId).single();
    expect(read?.read_at).not.toBeNull();
    expect(read?.delivered_at).not.toBeNull();

    const { error: outsiderErr } = await users.outsider.client.rpc("mark_messages_read", { conv: conversationId });
    expect(outsiderErr).not.toBeNull();
  });

  it("members cannot change another profile", async () => {
    await users.a.client.from("profiles").update({ display_name: "hacked" }).eq("id", users.b.id);
    const { data } = await admin.from("profiles").select("display_name").eq("id", users.b.id).single();
    expect(data?.display_name).not.toBe("hacked");
  });

  it("private images are only readable by members", async () => {
    const { data: ok } = await users.b.client.storage.from("chat-images").download(imagePath);
    expect(ok).not.toBeNull();
    const { data: denied } = await users.outsider.client.storage.from("chat-images").download(imagePath);
    expect(denied).toBeNull();
    const { data: signed } = await users.outsider.client.storage.from("chat-images").createSignedUrl(imagePath, 60);
    expect(signed).toBeNull();
  });

  it("outsiders cannot upload into the conversation folder", async () => {
    const { error } = await users.outsider.client.storage
      .from("chat-images")
      .upload(`${conversationId}/${randomUUID()}.png`, Buffer.from("x"), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("the bucket rejects non-image files", async () => {
    const { error } = await users.a.client.storage
      .from("chat-images")
      .upload(`${conversationId}/${randomUUID()}.html`, Buffer.from("<script>alert(1)</script>"), { contentType: "text/html" });
    expect(error).not.toBeNull();
  });

  it("image paths must belong to the conversation", async () => {
    const { error } = await users.a.client.from("messages").insert({
      conversation_id: conversationId,
      message_type: "image",
      image_url: `${randomUUID()}/elsewhere.png`,
    });
    expect(error).not.toBeNull();
  });

  it("outsiders cannot join the private realtime channel", async () => {
    const client = users.outsider.client;
    await client.realtime.setAuth();
    const status = await new Promise<string>((resolve) => {
      const channel = client.channel(`conversation:${conversationId}`, { config: { private: true } });
      const timer = setTimeout(() => resolve("TIMEOUT"), 10_000);
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR") {
          clearTimeout(timer);
          resolve(s);
          void client.removeChannel(channel);
        }
      });
    });
    expect(status).toBe("CHANNEL_ERROR");
  });

  it("a public channel with the same name cannot eavesdrop", async () => {
    const spy = users.outsider.client;
    const received: unknown[] = [];
    const spyChannel = spy.channel(`conversation:${conversationId}`);
    spyChannel
      .on("broadcast", { event: "typing" }, (p) => received.push(p))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => received.push(p));
    await new Promise<void>((resolve) => spyChannel.subscribe((s) => s === "SUBSCRIBED" && resolve()));

    const member = users.a.client;
    await member.realtime.setAuth();
    const channel = member.channel(`conversation:${conversationId}`, { config: { private: true } });
    await new Promise<void>((resolve) => channel.subscribe((s) => s === "SUBSCRIBED" && resolve()));
    await channel.send({ type: "broadcast", event: "typing", payload: { typing: true } });
    await member.from("messages").insert({ conversation_id: conversationId, content: "not for you" });
    await new Promise((r) => setTimeout(r, 2500));

    expect(received).toHaveLength(0);
    await spy.removeChannel(spyChannel);
    await member.removeChannel(channel);
  });

  it("members can join the private realtime channel", async () => {
    const client = users.b.client;
    await client.realtime.setAuth();
    const status = await new Promise<string>((resolve) => {
      const channel = client.channel(`conversation:${conversationId}`, { config: { private: true } });
      const timer = setTimeout(() => resolve("TIMEOUT"), 10_000);
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR") {
          clearTimeout(timer);
          resolve(s);
          void client.removeChannel(channel);
        }
      });
    });
    expect(status).toBe("SUBSCRIBED");
  });

  it("push addresses are private and only change through the RPCs", async () => {
    const endpoint = `https://push.example.test/${randomUUID()}`;
    const save = (client: Client, ep = endpoint) =>
      client.rpc("save_push_subscription", { sub_endpoint: ep, sub_p256dh: "key", sub_auth: "auth" });

    // Nobody reads or writes the table directly, not even the owner.
    expect((await users.a.client.from("push_subscriptions").select("*")).error).not.toBeNull();
    const direct = await users.outsider.client
      .from("push_subscriptions")
      .insert({ endpoint, user_id: users.b.id, p256dh: "k", auth: "a" });
    expect(direct.error).not.toBeNull();

    // Anonymous callers cannot save.
    const anon = createClient<Database>(url!, publishable!, opts);
    expect((await save(anon)).error).not.toBeNull();

    // Saving works and is owned by the caller.
    expect((await save(users.b.client)).error).toBeNull();
    const owned = await admin.from("push_subscriptions").select("user_id").eq("endpoint", endpoint).single();
    expect(owned.data?.user_id).toBe(users.b.id);

    // Someone else cannot delete it.
    await users.outsider.client.rpc("delete_push_subscription", { sub_endpoint: endpoint });
    expect((await admin.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint)).data).toHaveLength(1);

    // The owner can.
    await users.b.client.rpc("delete_push_subscription", { sub_endpoint: endpoint });
    expect((await admin.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint)).data).toHaveLength(0);

    // Only https push endpoints are accepted.
    expect((await save(users.b.client, "http://push.example.test/plain")).error).not.toBeNull();
  });

  it("rate limits message floods", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        users.a.client.from("messages").insert({ conversation_id: conversationId, content: `flood ${i}` }),
      ),
    );
    expect(results.some((r) => r.error?.message?.includes("RATE_LIMITED"))).toBe(true);
  });
});
