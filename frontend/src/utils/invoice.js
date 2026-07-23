import api from "../api/axios.js";

export const INVOICE_AVAILABLE = ["paid", "refunded", "refund-pending"];

// Authenticated binary download — a plain <a href> can't attach the
// Authorization header a protected route needs, so this fetches the PDF as
// a blob via the shared axios instance (which does attach it) and triggers
// the save manually. Used by both the client dashboard (own invoices) and
// the admin dashboard (any client's, for support purposes).
export async function downloadInvoice(order, showToast) {
  try {
    const res = await api.get(`/payments/orders/${order._id}/invoice`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `GivsiaTech-Invoice-${order.invoiceNumber || order._id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    showToast("Could not download the invoice right now", "error");
  }
}
