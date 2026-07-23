// Wraps Google's official Places API (legacy Text Search + Place Details
// endpoints) — the only ToS-compliant, non-scraping way to pull public
// business listing data in bulk. This does NOT return owner name or email
// (Google doesn't expose those); those fields stay empty unless filled in
// later via CSV import or manual entry.
//
// Requires GOOGLE_PLACES_API_KEY. Every call here costs real quota/$, so
// callers must be rate-limited (see middleware/rateLimit.js bizLeadLimiter)
// and capped to one search page per request — no auto-pagination.

const CATEGORY_QUERY_HINTS = {
  "restaurants-cafes": "restaurants and cafes",
  "photography-studios": "photography studios",
  "dental-clinics": "dental clinics",
  "medical-clinics": "medical clinics",
  "gyms-fitness": "gyms and fitness centers",
  "car-service-centers": "car service centers",
  "taxi-cab-services": "taxi and cab services",
  "beauty-salons": "beauty salons",
  "cosmetic-clinics": "cosmetic clinics",
  "boutiques": "clothing boutiques",
  "travel-agencies": "travel agencies",
  "tourism-agencies": "tourism agencies",
  "event-management": "event management companies",
  "digital-marketing-agencies": "digital marketing agencies",
  "real-estate-agencies": "real estate agencies",
  "educational-institutes": "educational institutes",
  "coaching-centers": "coaching centers",
  "hotels-resorts": "hotels and resorts",
  "interior-designers": "interior designers",
  "architects": "architects",
  "pet-clinics": "pet clinics",
  "veterinary-hospitals": "veterinary hospitals",
  "furniture-stores": "furniture stores",
  "electronics-stores": "electronics stores",
  "automobile-dealers": "automobile dealers",
  "local-retail": "local retail stores",
  other: "small businesses",
};

export function isPlacesConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

// A Facebook/Instagram/Linktree page isn't an "official website" for this
// module's purposes even though Google's website field is technically
// non-empty — most of the target businesses only have a social page.
const SOCIAL_ONLY_DOMAINS = ["facebook.com", "instagram.com", "linktr.ee", "wa.me", "linkedin.com"];

function classifyWebsite(website) {
  if (!website) return { websiteStatus: "no-website", confidence: 90 };
  try {
    const host = new URL(website).hostname.replace(/^www\./, "");
    if (SOCIAL_ONLY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return { websiteStatus: "no-website", confidence: 70 };
    }
    return { websiteStatus: "exists", confidence: 5 };
  } catch {
    return { websiteStatus: "no-website", confidence: 60 };
  }
}

function computeOpportunityScore({ websiteStatus, rating, reviewCount }) {
  let score = 50;
  if (websiteStatus === "no-website") score += 30;
  if ((rating || 0) >= 4) score += 10;
  if ((reviewCount || 0) < 20) score += 10;
  return Math.max(0, Math.min(100, score));
}

function addressComponent(components, type) {
  return components?.find((c) => c.types.includes(type))?.long_name || "";
}

async function placeDetails(placeId) {
  const fields = [
    "name", "formatted_address", "formatted_phone_number", "international_phone_number",
    "website", "url", "rating", "user_ratings_total", "address_component",
    "geometry", "photo", "business_status",
  ].join(",");
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${process.env.GOOGLE_PLACES_API_KEY}`
  );
  const data = await res.json();
  if (data.status !== "OK") return null;
  return data.result;
}

// Runs one Text Search page (Google caps at 20 results/page) for the given
// category + city/state/country, fetches Place Details for each hit, and
// returns normalized business records ready to be deduped/saved by the
// route handler. Does not touch the database itself.
export async function discoverBusinesses({ category, city, state, country }) {
  if (!isPlacesConfigured()) {
    throw Object.assign(new Error("GOOGLE_PLACES_API_KEY is not configured"), { code: "NOT_CONFIGURED" });
  }

  const hint = CATEGORY_QUERY_HINTS[category] || CATEGORY_QUERY_HINTS.other;
  const locationParts = [city, state, country].filter(Boolean).join(", ");
  const query = `${hint} in ${locationParts}`;

  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
  );
  const searchData = await searchRes.json();
  if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
    throw Object.assign(new Error(searchData.error_message || `Places search failed (${searchData.status})`), { code: "SEARCH_FAILED" });
  }

  const results = (searchData.results || []).slice(0, 20);
  const records = [];
  let skippedHasWebsite = 0;

  for (const place of results) {
    const details = await placeDetails(place.place_id);
    if (!details) continue;

    const { websiteStatus, confidence } = classifyWebsite(details.website);
    if (websiteStatus === "exists") {
      skippedHasWebsite += 1;
      continue; // the whole point of this module is finding businesses WITHOUT a website
    }

    const components = details.address_component || [];
    const rating = details.rating || null;
    const reviewCount = details.user_ratings_total || 0;

    records.push({
      businessName: details.name || place.name,
      category,
      phones: [details.formatted_phone_number || details.international_phone_number].filter(Boolean),
      address: details.formatted_address || place.formatted_address || "",
      city: addressComponent(components, "locality") || city || "",
      state: addressComponent(components, "administrative_area_level_1") || state || "",
      country: addressComponent(components, "country") || country || "",
      postalCode: addressComponent(components, "postal_code") || "",
      googleMapsLink: details.url || "",
      googlePlaceId: place.place_id,
      rating,
      reviewCount,
      websiteStatus,
      socialLinks: websiteStatus === "no-website" && details.website ? { other: details.website } : undefined,
      aiConfidenceScore: confidence,
      opportunityScore: computeOpportunityScore({ websiteStatus, rating, reviewCount }),
      source: "places-api",
    });
  }

  return { records, totalFound: results.length, skippedHasWebsite };
}
