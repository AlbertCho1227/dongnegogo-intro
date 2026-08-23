"use client";

import { createClient, type AuthChangeEvent, type Provider, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type WebFamilyMember = {
  id?: string;
  role: "어머니" | "아버지" | "나" | "아이";
  name: string | null;
  age_group: string;
  region: string;
};

export type WebUserAlert = {
  program_id: string;
  minutes_before: number;
  enabled_at: string;
  scheduled_at: string | null;
};

export type WebUserSnapshot = {
  favoriteTargets: Record<string, string[]>;
  alerts: WebUserAlert[];
  family: WebFamilyMember[];
};

export const WEB_AUTH_CONSENT_VERSION = "2026-08-11";
export const WEB_AUTH_CONSENT_STORAGE_KEY = "dongnegogo.web.legalConsentVersion";

let client: SupabaseClient | null | undefined;

function configuredClient() {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key?.startsWith("sb_publishable_")) {
    client = null;
    return client;
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return client;
}

function requireClient() {
  const current = configuredClient();
  if (!current) throw new Error("웹 계정 연결 설정을 확인해 주세요.");
  return current;
}

export function webAuthConfigured() {
  return Boolean(configuredClient());
}

export async function currentWebSession() {
  const current = configuredClient();
  if (!current) return null;
  const { data, error } = await current.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function observeWebSession(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const current = configuredClient();
  if (!current) return () => undefined;
  const { data } = current.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function signInToWeb(provider: Extract<Provider, "apple" | "google" | "kakao">) {
  const current = requireClient();
  const redirectTo = `${window.location.origin}/web`;
  const { error } = await current.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: provider === "kakao" ? { scope: "openid" } : undefined,
    },
  });
  if (error) throw error;
}

export async function signOutFromWeb() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function recordWebLegalConsents(session: Session, policyVersion = WEB_AUTH_CONSENT_VERSION) {
  const current = requireClient();
  const id = userID(session);
  const consentTypes = ["terms", "privacy"] as const;
  const { data, error } = await current.from("user_legal_consents")
    .select("consent_type")
    .eq("user_id", id)
    .eq("policy_version", policyVersion)
    .in("consent_type", [...consentTypes]);
  if (error) throw error;
  const recorded = new Set((data ?? []).map((row) => String(row.consent_type)));
  const missing = consentTypes.filter((consentType) => !recorded.has(consentType));
  if (!missing.length) return;
  const { error: insertError } = await current.from("user_legal_consents").insert(missing.map((consentType) => ({
    user_id: id,
    consent_type: consentType,
    policy_version: policyVersion,
    app_platform: "web",
  })));
  if (insertError && insertError.code !== "23505") throw insertError;
}

function userID(session: Session) {
  if (!session.user.id) throw new Error("로그인 정보를 다시 확인해 주세요.");
  return session.user.id;
}

export async function fetchWebUserSnapshot(session: Session): Promise<WebUserSnapshot> {
  const current = requireClient();
  const id = userID(session);
  const [favorites, alerts, family] = await Promise.all([
    current.from("user_favorites").select("program_id,favorite_targets").eq("user_id", id),
    current.from("open_run_alerts").select("program_id,minutes_before,enabled_at,scheduled_at").eq("user_id", id),
    current.from("family_members").select("id,role,name,age_group,region").eq("user_id", id).order("created_at"),
  ]);
  const error = favorites.error ?? alerts.error ?? family.error;
  if (error) throw error;
  return {
    favoriteTargets: Object.fromEntries((favorites.data ?? []).map((row) => [
      String(row.program_id),
      Array.isArray(row.favorite_targets) && row.favorite_targets.length
        ? row.favorite_targets.map(String)
        : ["personal"],
    ])),
    alerts: (alerts.data ?? []).map((row) => ({
      program_id: String(row.program_id),
      minutes_before: Number(row.minutes_before ?? 60),
      enabled_at: String(row.enabled_at ?? new Date().toISOString()),
      scheduled_at: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
    })),
    family: (family.data ?? []).flatMap((row) => {
      const role = String(row.role);
      if (role !== "어머니" && role !== "아버지" && role !== "나" && role !== "아이") return [];
      return [{
        id: String(row.id),
        role,
        name: typeof row.name === "string" ? row.name : null,
        age_group: String(row.age_group ?? ""),
        region: String(row.region ?? ""),
      } as WebFamilyMember];
    }),
  };
}

export async function upsertWebFavorite(session: Session, programID: string, targets: string[]) {
  const current = requireClient();
  const id = userID(session);
  const normalized = [...new Set(targets)].slice(0, 8);
  if (!normalized.length) {
    const { error } = await current.from("user_favorites").delete().eq("user_id", id).eq("program_id", programID);
    if (error) throw error;
    return;
  }
  const { error } = await current.from("user_favorites").upsert({
    user_id: id,
    program_id: programID,
    favorite_targets: normalized,
  }, { onConflict: "user_id,program_id" });
  if (error) throw error;
}

export async function upsertWebAlert(session: Session, programID: string, scheduledAt: string | null) {
  const current = requireClient();
  const id = userID(session);
  const { error } = await current.from("open_run_alerts").upsert({
    user_id: id,
    program_id: programID,
    minutes_before: 60,
    scheduled_at: scheduledAt,
  }, { onConflict: "user_id,program_id" });
  if (error) throw error;
}

export async function deleteWebAlert(session: Session, programID: string) {
  const { error } = await requireClient().from("open_run_alerts").delete()
    .eq("user_id", userID(session)).eq("program_id", programID);
  if (error) throw error;
}

export async function saveWebFamilyMember(session: Session, member: WebFamilyMember) {
  const current = requireClient();
  const id = userID(session);
  let remove = current.from("family_members").delete().eq("user_id", id).eq("role", member.role);
  if (member.name) remove = remove.eq("name", member.name);
  else remove = remove.is("name", null);
  const removed = await remove;
  if (removed.error) throw removed.error;
  const { error } = await current.from("family_members").insert({
    user_id: id,
    role: member.role,
    name: member.name || null,
    age_group: member.age_group,
    region: member.region,
  });
  if (error) throw error;
}

export async function deleteWebFamilyMember(session: Session, member: WebFamilyMember) {
  let query = requireClient().from("family_members").delete()
    .eq("user_id", userID(session)).eq("role", member.role);
  if (member.name) query = query.eq("name", member.name);
  else query = query.is("name", null);
  const { error } = await query;
  if (error) throw error;
}

export type { Session };
