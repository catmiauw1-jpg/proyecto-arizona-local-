import { getSupabaseClient } from "./supabaseClient.js?v=20260621-stage1-clean-all";

export async function signInWithPassword(email, password) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Correo o contrasena incorrectos.");
  return loadAuthorizedSession();
}

export async function signOut() {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
}

export async function loadAuthorizedSession() {
  const supabase = await getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return { status: "signedOut", user: null, profile: null, client: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("app_users")
    .select("id, auth_user_id, client_id, role, active")
    .eq("auth_user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (profileError) throw new Error("No se pudo validar el usuario.");

  if (!profile) {
    await supabase.auth.signOut();
    return {
      status: "unauthorized",
      user: userData.user,
      profile: null,
      client: null,
      message: "Usuario no autorizado para esta aplicacion.",
    };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, active")
    .eq("id", profile.client_id)
    .eq("active", true)
    .maybeSingle();

  if (clientError) throw new Error("No se pudo cargar el cliente.");

  if (!client) {
    await supabase.auth.signOut();
    return {
      status: "unauthorized",
      user: userData.user,
      profile: null,
      client: null,
      message: "El cliente asignado no esta activo.",
    };
  }

  return {
    status: "authorized",
    user: userData.user,
    profile,
    client,
  };
}
