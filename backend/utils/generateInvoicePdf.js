import PDFDocument from "pdfkit";

// "Rs." instead of "₹" throughout — PDFKit's built-in standard fonts
// (Helvetica et al.) are the 14 base PDF fonts, which don't include the
// Indian Rupee glyph (U+20B9). Embedding a custom Unicode font just for
// one symbol isn't worth the added complexity/bundle size here; the
// website itself still shows ₹ everywhere since browsers handle that fine.
const money = (paise) => `Rs. ${(paise / 100).toLocaleString("en-IN")}`;

const SERVICE_LABEL = {
  website: "Website",
  "ai-automation": "AI Automation",
  saas: "SaaS Platform",
  "app-development": "App Development",
  other: "Custom",
};

// Streams a one-page invoice PDF directly to the response — no temp file,
// nothing written to disk (keeps this stateless regardless of how/where
// the backend ends up hosted). Called from paymentRoutes.js's
// GET /orders/:id/invoice, only once an order has actually been paid.
export function generateInvoicePdf(order, res) {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  doc.pipe(res);

  const billedName = order.client?.name || order.manualClient?.name || "—";
  const billedEmail = order.client?.email || order.manualClient?.email || "—";
  const billedCompany = order.client?.company;

  // Header
  doc.fontSize(22).fillColor("#1a1410").text("GivsiaTech", { continued: false });
  doc.fontSize(10).fillColor("#666666").text("Givsia Private Limited");
  doc.moveDown(1.2);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor("#dddddd").stroke();
  doc.moveDown(1);

  // Title + meta
  doc.fontSize(16).fillColor("#1a1410").text("INVOICE");
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#333333");
  doc.text(`Invoice number: ${order.invoiceNumber || "—"}`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`);
  doc.text(`Payment reference: ${order.razorpayPaymentId || "—"}`);
  doc.moveDown(1);

  // Billed to
  doc.fontSize(11).fillColor("#1a1410").text("Billed to");
  doc.fontSize(10).fillColor("#333333");
  doc.text(billedName);
  doc.text(billedEmail);
  if (billedCompany) doc.text(billedCompany);
  doc.moveDown(1.2);

  // Line item table
  const tableTop = doc.y;
  const col = { desc: 56, service: 340, amount: 430 };
  doc.fontSize(9).fillColor("#888888");
  doc.text("DESCRIPTION", col.desc, tableTop);
  doc.text("SERVICE", col.service, tableTop);
  doc.text("AMOUNT", col.amount, tableTop, { width: 109, align: "right" });
  doc.moveTo(56, tableTop + 16).lineTo(539, tableTop + 16).strokeColor("#dddddd").stroke();

  const rowY = tableTop + 26;
  doc.fontSize(10).fillColor("#1a1410");
  doc.text(order.title, col.desc, rowY, { width: 270 });
  doc.text(SERVICE_LABEL[order.service] || order.service, col.service, rowY, { width: 80 });
  doc.text(money(order.amount), col.amount, rowY, { width: 109, align: "right" });

  const afterRowY = rowY + Math.max(doc.heightOfString(order.title, { width: 270 }), 14) + 14;
  doc.moveTo(56, afterRowY).lineTo(539, afterRowY).strokeColor("#dddddd").stroke();

  // Total
  doc.fontSize(13).fillColor("#1a1410").text("Total paid", col.service, afterRowY + 16, { width: 80 });
  doc.fontSize(13).text(money(order.amount), col.amount, afterRowY + 16, { width: 109, align: "right" });

  let cursorY = afterRowY + 44;

  // Refund note, if applicable — this order's invoice still reflects what
  // was actually charged; the refund is recorded as a separate line so the
  // document stays an accurate paid-then-refunded record, not a rewritten one.
  if (order.paymentStatus === "refunded" && order.refundAmount) {
    doc.fontSize(10).fillColor("#b3541e");
    doc.text(`Refunded: ${money(order.refundAmount)} on ${order.refundedAt ? new Date(order.refundedAt).toLocaleDateString("en-IN") : "—"}`, col.desc, cursorY);
    if (order.refundId) doc.text(`Refund reference: ${order.refundId}`, col.desc, doc.y + 2);
    cursorY = doc.y + 20;
  }

  // Footer
  doc.fontSize(8).fillColor("#999999").text(
    "This is a computer-generated invoice from GivsiaTech (Givsia Private Limited) and does not require a signature.",
    56,
    Math.max(cursorY, 760),
    { width: 483, align: "center" }
  );

  doc.end();
}
