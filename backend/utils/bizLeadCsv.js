import { parse } from "csv-parse/sync";

// Columns a CSV export produces, and an import expects (case-insensitive,
// extra/missing columns are tolerated — only businessName is required).
export const CSV_COLUMNS = [
  "businessName", "category", "ownerName", "phone", "email",
  "address", "city", "state", "country", "postalCode",
  "googleMapsLink", "rating", "reviewCount", "websiteStatus", "websiteUrl",
  "description", "businessSize", "leadStatus",
  "registrationDate", "registrationNumber", "directors",
];

function csvField(value) {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function leadsToCsv(leads) {
  const header = CSV_COLUMNS.join(",");
  const rows = leads.map((l) =>
    [
      l.businessName, l.category, l.ownerName, (l.phones || []).join(";"), l.email,
      l.address, l.city, l.state, l.country, l.postalCode,
      l.googleMapsLink, l.rating, l.reviewCount, l.websiteStatus, l.websiteUrl,
      l.description, l.businessSize, l.leadStatus,
      l.registrationDate ? new Date(l.registrationDate).toISOString().slice(0, 10) : "",
      l.registrationNumber, (l.directors || []).join(";"),
    ]
      .map(csvField)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

// Parses an uploaded CSV buffer into plain row objects keyed by whatever
// header names were used, lower-cased and stripped of spaces/underscores so
// "Business Name", "business_name", and "businessName" all map the same.
export function parseLeadsCsv(buffer) {
  const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  const normalizeKey = (k) => k.toLowerCase().replace(/[\s_]+/g, "");
  const keyMap = {
    businessname: "businessName", name: "businessName",
    category: "category",
    ownername: "ownerName", owner: "ownerName",
    phone: "phone", phones: "phone", contactnumber: "phone",
    email: "email", emailaddress: "email",
    address: "address", city: "city", state: "state", country: "country",
    postalcode: "postalCode", zip: "postalCode", pincode: "postalCode",
    googlemapslink: "googleMapsLink", maps: "googleMapsLink",
    rating: "rating", reviewcount: "reviewCount", reviews: "reviewCount",
    websitestatus: "websiteStatus", websiteurl: "websiteUrl", website: "websiteUrl",
    description: "description", businesssize: "businessSize", leadstatus: "leadStatus",
    registrationdate: "registrationDate", cin: "registrationNumber", registrationnumber: "registrationNumber",
    directors: "directors",
  };

  return records.map((row) => {
    const mapped = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const mappedKey = keyMap[normalizeKey(rawKey)];
      if (mappedKey) mapped[mappedKey] = value;
    }
    return mapped;
  });
}
