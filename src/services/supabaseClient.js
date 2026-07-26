import { createClient } from "/desktop/localSupabaseClient.js";

let configPromise;
let clientPromise;

async function loadPublicConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/config", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar la configuración local.");
      const config = await response.json();
      if (!config.configured || !config.supabaseUrl || !config.supabasePublishableKey) {
        throw new Error("El almacenamiento local no está configurado.");
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
