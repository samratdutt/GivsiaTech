import Pricing from "../models/Pricing.js";
import Portfolio from "../models/Portfolio.js";
import CompanyInfo from "../models/CompanyInfo.js";

// Grounds an AI draft in the site's real, current pricing/portfolio/company
// data instead of letting it invent numbers or case studies. Shared by
// outreachRoutes.js (general cold outreach) and bizLeadRoutes.js (business
// lead outreach/proposals) so both draw from the same facts.
export async function buildServiceContext() {
  const [tiers, portfolioItems, company] = await Promise.all([
    Pricing.find({ isActive: true }).sort({ order: 1, createdAt: 1 }),
    Portfolio.find({ isActive: true }).sort({ order: 1, createdAt: 1 }),
    CompanyInfo.findOne(),
  ]);

  const pricingText = tiers.length
    ? tiers.map((t) => `- ${t.name}: ${t.price} — ${t.desc.replace(/\.+$/, "")}`).join("\n")
    : "No pricing tiers are currently published.";
  const portfolioText = portfolioItems.length
    ? portfolioItems.map((p) => `- ${p.title} (${p.tag}): ${p.desc}`).join("\n")
    : "No portfolio items are currently published.";
  const companyText = company ? `${company.heading}\n${company.description}` : "GivsiaTech is a software studio by Givsia Private Limited.";

  return `ABOUT THE COMPANY:\n${companyText}\n\nSERVICES / PRICING:\n${pricingText}\n\nPAST WORK:\n${portfolioText}`;
}
