import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

let configPromise;
let clientPromise;

async function loadPublicConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/config", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar la configuracion de Supabase.");
      const config = await response.json();
      if (!config.configured || !config.supabaseUrl || !config.supabasePublishableKey) {
        throw new Error("Supabase no esta configurado para este entorno.");
      }
      return config;
    });
  }

  return configPromise;
}

export async function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = loadPublicConfig().then((config) =>
      createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }),
    );
  }

  return clientPromise;
}
