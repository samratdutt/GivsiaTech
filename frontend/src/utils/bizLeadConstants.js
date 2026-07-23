export const BIZ_LEAD_CATEGORIES = [
  { value: "restaurants-cafes", label: "Restaurants & Cafés" },
  { value: "photography-studios", label: "Photography Studios" },
  { value: "dental-clinics", label: "Dental Clinics" },
  { value: "medical-clinics", label: "Medical Clinics" },
  { value: "gyms-fitness", label: "Gyms & Fitness Centers" },
  { value: "car-service-centers", label: "Car Service Centers" },
  { value: "taxi-cab-services", label: "Taxi & Cab Services" },
  { value: "beauty-salons", label: "Beauty Salons" },
  { value: "cosmetic-clinics", label: "Cosmetic Clinics" },
  { value: "boutiques", label: "Boutiques" },
  { value: "travel-agencies", label: "Travel Agencies" },
  { value: "tourism-agencies", label: "Tourism Agencies" },
  { value: "event-management", label: "Event Management" },
  { value: "digital-marketing-agencies", label: "Digital Marketing Agencies" },
  { value: "real-estate-agencies", label: "Real Estate Agencies" },
  { value: "educational-institutes", label: "Educational Institutes" },
  { value: "coaching-centers", label: "Coaching Centers" },
  { value: "hotels-resorts", label: "Hotels & Resorts" },
  { value: "interior-designers", label: "Interior Designers" },
  { value: "architects", label: "Architects" },
  { value: "pet-clinics", label: "Pet Clinics" },
  { value: "veterinary-hospitals", label: "Veterinary Hospitals" },
  { value: "furniture-stores", label: "Furniture Stores" },
  { value: "electronics-stores", label: "Electronics Stores" },
  { value: "automobile-dealers", label: "Automobile Dealers" },
  { value: "local-retail", label: "Local Retail" },
  { value: "other", label: "Other" },
];

export const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Kolkata", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Ahmedabad",
  "Jaipur", "Lucknow", "Surat", "Chandigarh", "Indore", "Bhopal", "Bhubaneswar", "Kochi",
  "Nagpur", "Patna", "Guwahati", "Visakhapatnam", "Coimbatore", "Vadodara", "Nashik",
  "Ranchi", "Raipur", "Amritsar", "Varanasi", "Agra", "Dehradun", "Mysuru",
];

export const COUNTRIES = [
  "India", "United States", "Canada", "United Kingdom", "Australia", "Germany", "France",
  "UAE", "Singapore", "Japan", "South Korea", "Other",
];

export const LEAD_STATUSES = [
  { value: "new", label: "New Lead", color: "#6ee7ff" },
  { value: "contacted", label: "Contacted", color: "#7dd3fc" },
  { value: "follow-up", label: "Follow-Up Scheduled", color: "#c3aeff" },
  { value: "meeting", label: "Meeting Booked", color: "#8b6fe8" },
  { value: "proposal", label: "Proposal Sent", color: "#ffd94d" },
  { value: "negotiation", label: "Negotiation", color: "#ff9f4d" },
  { value: "won", label: "Won (Done Deal)", color: "#4ade80" },
  { value: "lost", label: "Lost", color: "#ff6b6b" },
  { value: "do-not-contact", label: "Do Not Contact", color: "#666" },
];

export const WEBSITE_STATUSES = [
  { value: "no-website", label: "No Website" },
  { value: "exists", label: "Website Exists" },
  { value: "broken", label: "Website Broken/Inactive" },
];

export const BUSINESS_SIZES = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function statusMeta(value) {
  return LEAD_STATUSES.find((s) => s.value === value) || LEAD_STATUSES[0];
}

export function categoryLabel(value) {
  return BIZ_LEAD_CATEGORIES.find((c) => c.value === value)?.label || value;
}
