/**
 * AgriSense — Supabase Client
 * Handles database connection, auth, and data sync.
 */

const SUPABASE_URL = "https://dubbascipfqsirqfrtbb.supabase.co";
const SUPABASE_KEY = "sb_publishable_i14L_322JxPXNa0grNg0xA_yX5B65u5";

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ============ AUTH HELPERS ============ */

async function getUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

async function signUpWithEmail(email, password, fullName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
  return { data, error };
}

async function signInWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

async function signInWithGoogle() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/index.html"
    }
  });
  return { data, error };
}

async function signOut() {
  sessionStorage.removeItem("agrisense_guest");
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {}
  window.location.href = "login.html";
}

/* ============ DATABASE HELPERS ============ */

async function saveReadingToDB(snapshot) {
  let user = null;
  try { user = await getUser(); } catch (e) {}

  try {
    const row = {
      location: snapshot.location || "Unknown",
      latitude: snapshot.lat || null,
      longitude: snapshot.lon || null,
      crop: snapshot.crop || "Unknown",
      temperature: snapshot.temp ?? null,
      humidity: snapshot.hum ?? null,
      soil_moisture: snapshot.soilM ?? null,
      soil_temperature: snapshot.soilT ?? null,
      rainfall: snapshot.rainfall ?? null,
      wind_speed: snapshot.wind ?? null,
      health_score: snapshot.score ?? null,
      ndvi: snapshot.ndvi ?? null
    };
    if (user && user.id) row.user_id = user.id;

    const { data, error } = await supabaseClient
      .from("sensor_readings")
      .insert([row]);

    if (error) {
      console.warn("[AgriSense] DB save error:", error.message);
    } else {
      console.log("[AgriSense] ✅ Reading synced to Supabase");
      updateDBStatus("connected", "🟢 Supabase: Synced");
    }
    return data;
  } catch (err) {
    console.warn("[AgriSense] DB save exception:", err);
    return null;
  }
}

async function saveAlertToDB(alertObj) {
  let user = null;
  try { user = await getUser(); } catch (e) {}

  try {
    const row = {
      location: alertObj.location || "Unknown",
      crop: alertObj.crop || "Unknown",
      alert_level: alertObj.level || "info",
      message: alertObj.msg || ""
    };
    if (user && user.id) row.user_id = user.id;

    const { data, error } = await supabaseClient
      .from("sensor_alerts")
      .insert([row]);

    if (error) console.warn("[AgriSense] Alert save error:", error.message);
    return data;
  } catch (err) {
    console.warn("[AgriSense] Alert save exception:", err);
    return null;
  }
}

async function fetchRecentReadings(limit = 50) {
  const user = await getUser();
  if (!user) return [];

  try {
    const { data, error } = await supabaseClient
      .from("sensor_readings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("[AgriSense] Fetch readings error:", err);
    return [];
  }
}

async function fetchRecentAlerts(limit = 20) {
  const user = await getUser();
  if (!user) return [];

  try {
    const { data, error } = await supabaseClient
      .from("sensor_alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("[AgriSense] Fetch alerts error:", err);
    return [];
  }
}

async function getReadingCount() {
  const user = await getUser();
  if (!user) return 0;

  const { count, error } = await supabaseClient
    .from("sensor_readings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return error ? 0 : count;
}

/* ============ UI STATUS BADGE ============ */

function updateDBStatus(type, text) {
  const el = document.getElementById("dbStatusTag");
  if (!el) return;
  el.textContent = text;
  el.className = "zone-tag db-status-" + type;
}

/* ============ CONNECTION TEST ============ */

async function testSupabaseConnection() {
  try {
    const session = await getSession();
    const isGuest = sessionStorage.getItem("agrisense_guest") === "true";
    if (!session && !isGuest) {
      updateDBStatus("standby", "🗄️ Supabase: Ready");
      return false;
    }
    const { error } = await supabaseClient
      .from("sensor_readings")
      .select("id")
      .limit(1);

    if (error && error.code !== "PGRST116" && error.code !== "42501") {
      updateDBStatus("warn", "⚠️ Supabase: Checking Tables");
      return false;
    }
    updateDBStatus("connected", "🟢 Supabase: Connected");
    return true;
  } catch (e) {
    updateDBStatus("error", "⚠️ Supabase: Local Mode");
    return false;
  }
}

// Run connection test on load
testSupabaseConnection();
