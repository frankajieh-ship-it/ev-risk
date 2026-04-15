/**
 * OFFO Listing Receipt — PDF Template
 *
 * Page 1: Core Receipt (verdict, price sanity, risk flags, questions, inspection, negotiation)
 * Page 2 (conditional): Deep Dive (market comparison, scripts, cost of ownership, known issues)
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { ReceiptPdfData } from "./shared-types";

const COLORS = {
  green: "#16a34a",
  yellow: "#ca8a04",
  red: "#dc2626",
  blue: "#2563eb",
  gray: "#6b7280",
  darkGray: "#374151",
  lightGray: "#f3f4f6",
  border: "#e5e7eb",
  white: "#ffffff",
};

const VERDICT_COLORS: Record<string, { color: string; bg: string }> = {
  GREEN: { color: COLORS.green, bg: "#f0fdf4" },
  YELLOW: { color: COLORS.yellow, bg: "#fefce8" },
  RED: { color: COLORS.red, bg: "#fef2f2" },
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: COLORS.white,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: `2px solid ${COLORS.border}`,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  receiptId: {
    fontSize: 8,
    color: COLORS.gray,
    fontFamily: "Courier",
  },

  // Verdict hero
  verdictSection: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
  },
  verdictLabel: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  verdictSublabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
  },
  verdictReason: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.darkGray,
  },

  // Price sanity
  priceSanityBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
  },
  priceSanityLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  priceSanityDetail: {
    fontSize: 9,
    color: COLORS.gray,
    lineHeight: 1.4,
  },

  // Sections
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: COLORS.darkGray,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 4,
  },

  // Bullets
  bulletPoint: {
    fontSize: 10,
    marginBottom: 5,
    paddingLeft: 14,
    lineHeight: 1.5,
  },
  bulletSymbol: {
    position: "absolute",
    left: 0,
  },

  // Negotiation
  negotiationBox: {
    padding: 10,
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    border: `1px solid #bbf7d0`,
    marginBottom: 14,
  },
  negotiationText: {
    fontSize: 10,
    color: COLORS.darkGray,
    lineHeight: 1.5,
    fontStyle: "italic",
  },

  // Details
  detailsBox: {
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
    marginBottom: 14,
  },
  detailsLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 9,
    color: COLORS.gray,
    marginBottom: 2,
  },

  // Deep dive table
  tableRow: {
    flexDirection: "row",
    borderBottom: `1px solid ${COLORS.border}`,
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: `2px solid ${COLORS.darkGray}`,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.darkGray,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.darkGray,
  },

  // Cost of ownership
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  costLabel: {
    fontSize: 10,
    color: COLORS.darkGray,
  },
  costValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.darkGray,
  },
  costTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTop: `2px solid ${COLORS.darkGray}`,
  },

  // Negotiation script
  scriptBox: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
  },
  scriptScenario: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.blue,
    marginBottom: 4,
  },
  scriptOpening: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.darkGray,
    marginBottom: 4,
    fontStyle: "italic",
  },
  scriptBody: {
    fontSize: 9,
    color: COLORS.gray,
    lineHeight: 1.5,
  },

  // Divider
  divider: {
    borderBottom: `1px solid ${COLORS.border}`,
    marginVertical: 14,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLORS.gray,
    textAlign: "center",
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 8,
  },
});

const VERDICT_LABELS: Record<string, string> = {
  GREEN: "Good Deal",
  YELLOW: "Proceed with Caution",
  RED: "High Risk",
};

export const ReceiptPdf: React.FC<{ data: ReceiptPdfData }> = ({ data }) => {
  const vc = VERDICT_COLORS[data.verdict] || VERDICT_COLORS.YELLOW;
  const ls = data.listingSummary;
  const vehicleDesc = [ls.year > 0 ? ls.year : null, ls.make, ls.model, ls.trim]
    .filter(Boolean)
    .join(" ");
  const priceStr = ls.price > 0 ? `$${ls.price.toLocaleString()}` : "Price unlisted";

  return (
    <Document>
      {/* PAGE 1: Core Receipt */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>OFFO Listing Receipt</Text>
          <Text style={styles.subtitle}>
            {vehicleDesc} — {priceStr}
          </Text>
          <Text style={styles.receiptId}>Receipt ID: {data.receiptId}</Text>
        </View>

        {/* Verdict */}
        <View style={[styles.verdictSection, { backgroundColor: vc.bg }]}>
          <Text style={[styles.verdictLabel, { color: vc.color }]}>
            {data.verdict}
          </Text>
          <Text style={[styles.verdictSublabel, { color: vc.color }]}>
            {VERDICT_LABELS[data.verdict] || "Unknown"}
          </Text>
          <Text style={styles.verdictReason}>{data.verdictReason}</Text>
        </View>

        {/* Price Sanity */}
        {data.priceSanity && (
          <View style={styles.priceSanityBox}>
            <Text style={styles.priceSanityLabel}>
              Price: {data.priceSanity.label}
              {data.priceSanity.confidence > 0
                ? ` (${Math.round(data.priceSanity.confidence * 100)}% confidence)`
                : ""}
            </Text>
            <Text style={styles.priceSanityDetail}>
              {data.priceSanity.rationale}
            </Text>
          </View>
        )}

        {/* Risk Flags */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.red }]}>
            Risk Flags
          </Text>
          {data.riskFlags.map((flag, i) => (
            <View key={i} style={styles.bulletPoint}>
              <Text style={[styles.bulletSymbol, { color: COLORS.red }]}>!</Text>
              <Text>{flag}</Text>
            </View>
          ))}
        </View>

        {/* Must-Ask Questions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.blue }]}>
            Must-Ask Questions
          </Text>
          {data.mustAnswerQuestions.map((q, i) => (
            <View key={i} style={styles.bulletPoint}>
              <Text style={[styles.bulletSymbol, { color: COLORS.blue }]}>
                {i + 1}.
              </Text>
              <Text>{q}</Text>
            </View>
          ))}
        </View>

        {/* Inspect First */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspect First</Text>
          {data.inspectFirst.map((item, i) => (
            <View key={i} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Negotiation Opener */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.green }]}>
            Negotiation Opener
          </Text>
          <View style={styles.negotiationBox}>
            <Text style={styles.negotiationText}>
              {data.negotiationOpener}
            </Text>
          </View>
        </View>

        {/* Receipt Details */}
        {data.receiptDetails && (
          <>
            {data.receiptDetails.feeEstimates && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsLabel}>Fee Estimates</Text>
                {data.receiptDetails.feeEstimates.taxEstimateRange && (
                  <Text style={styles.detailsText}>
                    Tax: ${data.receiptDetails.feeEstimates.taxEstimateRange.low.toLocaleString()} – ${data.receiptDetails.feeEstimates.taxEstimateRange.high.toLocaleString()}
                  </Text>
                )}
                {data.receiptDetails.feeEstimates.docFeeEstimateRange && (
                  <Text style={styles.detailsText}>
                    Doc fee: ${data.receiptDetails.feeEstimates.docFeeEstimateRange.low.toLocaleString()} – ${data.receiptDetails.feeEstimates.docFeeEstimateRange.high.toLocaleString()}
                  </Text>
                )}
                {data.receiptDetails.feeEstimates.notes && (
                  <Text style={styles.detailsText}>
                    {data.receiptDetails.feeEstimates.notes}
                  </Text>
                )}
              </View>
            )}

            {data.receiptDetails.walkAwayTriggers.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: COLORS.red }]}>
                  Walk-Away Triggers
                </Text>
                {data.receiptDetails.walkAwayTriggers.map((t, i) => (
                  <View key={i} style={styles.bulletPoint}>
                    <Text style={[styles.bulletSymbol, { color: COLORS.red }]}>!</Text>
                    <Text>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* QR Code share section (shown only when no deep dive page follows) */}
        {!data.deepDive && data.shareQrDataUri && (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 6,
              border: `1px solid ${COLORS.border}`,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Image src={data.shareQrDataUri} style={{ width: 70, height: 70 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "bold", color: COLORS.darkGray, marginBottom: 4 }}>
                Share this verdict
              </Text>
              <Text style={{ fontSize: 8, color: COLORS.gray, lineHeight: 1.4 }}>
                Scan to view the full interactive report at OFFO Lab.
              </Text>
              {data.shareUrl && (
                <Text style={{ fontSize: 7, color: COLORS.gray, marginTop: 2, fontFamily: "Courier" }}>
                  {data.shareUrl}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by OFFO Lab | For informational purposes only
          </Text>
          <Text>{data.generatedAt}</Text>
        </View>
      </Page>

      {/* PAGE 2: Deep Dive (conditional) */}
      {data.deepDive && (
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Decision Pack — Deep Dive</Text>
            <Text style={styles.subtitle}>
              {vehicleDesc} — {priceStr}
            </Text>
          </View>

          {/* Deep Verdict */}
          <View style={[styles.verdictSection, { backgroundColor: vc.bg, padding: 12 }]}>
            <Text style={[styles.verdictSublabel, { color: vc.color, marginBottom: 4 }]}>
              Deep Analysis
            </Text>
            <Text style={styles.verdictReason}>
              {data.deepDive.verdict_deep}
            </Text>
          </View>

          {/* Market Comparison */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Comparison</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "35%" }]}>Vehicle</Text>
              <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Price</Text>
              <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Mileage</Text>
              <Text style={[styles.tableHeaderCell, { width: "15%" }]}>vs. Yours</Text>
              <Text style={[styles.tableHeaderCell, { width: "10%" }]}>Source</Text>
            </View>
            {data.deepDive.market_comparison.map((comp, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "35%" }]}>{comp.title}</Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  ${comp.price.toLocaleString()}
                </Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  {comp.mileage.toLocaleString()} mi
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "15%", color: comp.delta_pct < 0 ? COLORS.green : COLORS.red },
                  ]}
                >
                  {comp.delta_pct > 0 ? "+" : ""}{comp.delta_pct.toFixed(1)}%
                </Text>
                <Text style={[styles.tableCell, { width: "10%", fontSize: 8 }]}>
                  {comp.source}
                </Text>
              </View>
            ))}
          </View>

          {/* Extended Inspection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extended Inspection Checklist</Text>
            {data.deepDive.extended_inspection.map((item, i) => (
              <View key={i} style={styles.bulletPoint}>
                <Text style={[styles.bulletSymbol, { color: COLORS.blue }]}>
                  {i + 1}.
                </Text>
                <Text>{item}</Text>
              </View>
            ))}
          </View>

          {/* Negotiation Scripts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Negotiation Scripts</Text>
            {data.deepDive.negotiation_scripts.map((script, i) => (
              <View key={i} style={styles.scriptBox}>
                <Text style={styles.scriptScenario}>
                  Scenario {i + 1}: {script.scenario}
                </Text>
                <Text style={styles.scriptOpening}>{script.opening}</Text>
                <Text style={styles.scriptBody}>{script.body}</Text>
              </View>
            ))}
          </View>

          {/* Cost of Ownership */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3-Year Cost of Ownership</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Insurance</Text>
              <Text style={styles.costValue}>
                ${data.deepDive.cost_of_ownership.insurance_yr.toLocaleString()}/yr
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Maintenance</Text>
              <Text style={styles.costValue}>
                ${data.deepDive.cost_of_ownership.maintenance_yr.toLocaleString()}/yr
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Fuel / Charging</Text>
              <Text style={styles.costValue}>
                ${data.deepDive.cost_of_ownership.fuel_or_charging_yr.toLocaleString()}/yr
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Depreciation</Text>
              <Text style={styles.costValue}>
                ${data.deepDive.cost_of_ownership.depreciation_yr.toLocaleString()}/yr
              </Text>
            </View>
            <View style={styles.costTotal}>
              <Text style={[styles.costLabel, { fontWeight: "bold", fontSize: 11 }]}>
                3-Year Total
              </Text>
              <Text style={[styles.costValue, { fontSize: 11 }]}>
                ${data.deepDive.cost_of_ownership.total_3yr.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Model Known Issues */}
          {data.deepDive.model_known_issues.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: COLORS.yellow }]}>
                Model-Specific Known Issues
              </Text>
              {data.deepDive.model_known_issues.map((issue, i) => (
                <View key={i} style={styles.bulletPoint}>
                  <Text style={[styles.bulletSymbol, { color: COLORS.yellow }]}>
                    !
                  </Text>
                  <Text>{issue}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Disclaimer */}
          <View
            style={{
              marginTop: 12,
              padding: 10,
              backgroundColor: COLORS.lightGray,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 8, color: COLORS.gray, lineHeight: 1.5 }}>
              Market comparisons are estimates based on publicly available listing data and may not reflect
              current market conditions. Cost of ownership estimates are based on national averages and may
              vary by location and driving habits. Always obtain a pre-purchase inspection before buying.
            </Text>
          </View>

          {/* QR Code share section */}
          {data.shareQrDataUri && (
            <View
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Image src={data.shareQrDataUri} style={{ width: 70, height: 70 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: "bold", color: COLORS.darkGray, marginBottom: 4 }}>
                  Share this verdict
                </Text>
                <Text style={{ fontSize: 8, color: COLORS.gray, lineHeight: 1.4 }}>
                  Scan to view the full interactive report at OFFO Lab.
                </Text>
                {data.shareUrl && (
                  <Text style={{ fontSize: 7, color: COLORS.gray, marginTop: 2, fontFamily: "Courier" }}>
                    {data.shareUrl}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text>
              Generated by OFFO Lab | Decision Pack — For informational purposes only
            </Text>
            <Text>{data.generatedAt}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};
