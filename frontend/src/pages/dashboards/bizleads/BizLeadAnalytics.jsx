import { useEffect, useState } from "react";
import api from "../../../api/axios.js";
import { categoryLabel } from "../../../utils/bizLeadConstants.js";

export default function BizLeadAnalytics({ moduleType, refreshTick }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/bizleads/analytics", { params: { moduleType } }).then((res) => setData(res.data)).catch(() => {});
  }, [moduleType, refreshTick]);

  if (!data) return null;

  const cards = [
    { label: "Total leads", value: data.total },
    { label: "New today", value: data.newToday },
    { label: "Contacted", value: data.contacted },
    { label: "Pending", value: data.pending },
    { label: "Follow-ups due", value: data.followUpsDue },
    { label: "Won", value: data.won, color: "#4ade80" },
    { label: "Lost", value: data.lost, color: "#ff6b6b" },
    { label: "Conversion rate", value: `${data.conversionRate}%` },
  ];

  const maxCategoryCount = Math.max(1, ...data.byCategory.map((c) => c.count));

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={styles.cardGrid}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={{ ...styles.cardValue, color: c.color || "var(--text)" }}>{c.value}</div>
            <div style={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {data.byCategory.length > 0 && (
        <div style={styles.chartCard}>
          <h4 style={styles.chartHeading}>Leads by category</h4>
          {data.byCategory.slice(0, 8).map((c) => (
            <div key={c._id} style={styles.barRow}>
              <span style={styles.barLabel}>{categoryLabel(c._id)}</span>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${(c.count / maxCategoryCount) * 100}%` }} />
              </div>
              <span style={styles.barCount}>{c.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 12px", textAlign: "center" },
  cardValue: { fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-display)" },
  cardLabel: { fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 },
  chartCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 },
  chartHeading: { margin: "0 0 10px", fontSize: "0.85rem" },
  barRow: { display: "grid", gridTemplateColumns: "160px 1fr 30px", alignItems: "center", gap: 10, marginBottom: 6 },
  barLabel: { fontSize: "0.75rem", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  barTrack: { height: 8, background: "var(--bg-soft)", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg, var(--lavender-deep), var(--lavender))", borderRadius: 999 },
  barCount: { fontSize: "0.75rem", color: "var(--text-dim)", textAlign: "right" },
};
