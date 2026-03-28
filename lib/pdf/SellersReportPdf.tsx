/**
 * OFFO Sellers Report PDF Template
 * Uses @react-pdf/renderer for PDF generation
 *
 * Fixed layout — no open-ended LLM fields in the PDF body.
 * Sections:
 *  1. Header: OFFO logo text + "Sellers Report" + date
 *  2. Vehicle summary card
 *  3. Routine fit highlights (bullet list)
 *  4. Recall & maintenance snapshot
 *  5. Buyer-ready Q&A (3–5 fixed questions)
 *  6. OFFO credibility footer + verification URL
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { SellersReportPdfData } from "./shared-types.js";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
    padding: 40,
  },
  // ---- Header ----
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1.5 solid #2563eb",
  },
  headerLeft: {
    flexDirection: "column",
  },
  brandName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
    letterSpacing: 0.5,
  },
  reportType: {
    fontSize: 12,
    color: "#374151",
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  dateText: {
    fontSize: 9,
    color: "#6b7280",
  },
  tagline: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 2,
  },
  // ---- Section ----
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  // ---- Vehicle Summary Card ----
  vehicleCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    padding: 14,
    borderLeft: "3 solid #2563eb",
    marginBottom: 6,
  },
  vehicleTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
  },
  vehicleSub: {
    fontSize: 9,
    color: "#374151",
    marginTop: 3,
  },
  vehicleRange: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  // ---- Bullet list ----
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  bulletDot: {
    width: 14,
    fontSize: 9,
    color: "#2563eb",
    fontFamily: "Helvetica-Bold",
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },
  // ---- Recall snapshot ----
  recallBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    padding: 12,
    borderLeft: "3 solid #16a34a",
  },
  recallBoxWarn: {
    backgroundColor: "#fff7ed",
    borderLeft: "3 solid #f59e0b",
  },
  recallSummaryText: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 4,
    lineHeight: 1.5,
  },
  recallCount: {
    fontSize: 9,
    color: "#6b7280",
  },
  // ---- Q&A ----
  qaItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "0.5 solid #e5e7eb",
  },
  qaItemLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottom: "none",
  },
  qaQuestion: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 3,
  },
  qaAnswer: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },
  // ---- Footer ----
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: "0.5 solid #e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerLeft: {
    flexDirection: "column",
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
  },
  footerSub: {
    fontSize: 7,
    color: "#9ca3af",
    marginTop: 1,
  },
  footerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  verifyLabel: {
    fontSize: 7,
    color: "#9ca3af",
  },
  verifyToken: {
    fontSize: 7,
    color: "#6b7280",
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
});

interface SellersReportPdfProps {
  data: SellersReportPdfData;
}

export function SellersReportPdf({ data }: SellersReportPdfProps) {
  const {
    vehicle_summary,
    routine_fit_highlights,
    recall_snapshot,
    buyer_ready_answers,
    verification_token,
    generated_at,
  } = data;

  const generatedDate = new Date(generated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const vehicleTitle = [
    vehicle_summary.year,
    vehicle_summary.make,
    vehicle_summary.model,
    vehicle_summary.trim,
  ]
    .filter(Boolean)
    .join(" ");

  const hasOpenRecalls = recall_snapshot.open_count > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandName}>OFFO</Text>
            <Text style={styles.reportType}>Sellers Report</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{generatedDate}</Text>
            <Text style={styles.tagline}>EV ownership intelligence</Text>
          </View>
        </View>

        {/* 2. Vehicle Summary Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>{vehicleTitle}</Text>
            {vehicle_summary.vin_redacted && (
              <Text style={styles.vehicleSub}>
                VIN: {vehicle_summary.vin_redacted}
              </Text>
            )}
            {vehicle_summary.range_mi && (
              <Text style={styles.vehicleRange}>
                Rated range: {vehicle_summary.range_mi} mi (EPA)
              </Text>
            )}
          </View>
        </View>

        {/* 3. Routine Fit Highlights */}
        {routine_fit_highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Routine Fit Highlights</Text>
            {routine_fit_highlights.map((highlight, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>✓</Text>
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 4. Recall Snapshot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recall &amp; Maintenance Snapshot</Text>
          <View style={[styles.recallBox, hasOpenRecalls ? styles.recallBoxWarn : {}]}>
            <Text style={styles.recallSummaryText}>{recall_snapshot.summary}</Text>
            <Text style={styles.recallCount}>
              Open recalls: {recall_snapshot.open_count} · Resolved: {recall_snapshot.resolved_count}
            </Text>
          </View>
        </View>

        {/* 5. Buyer-Ready Q&A */}
        {buyer_ready_answers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buyer-Ready Answers</Text>
            {buyer_ready_answers.map((qa, i) => (
              <View
                key={i}
                style={i === buyer_ready_answers.length - 1 ? styles.qaItemLast : styles.qaItem}
              >
                <Text style={styles.qaQuestion}>{qa.question}</Text>
                <Text style={styles.qaAnswer}>{qa.answer}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 6. Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text style={styles.footerBrand}>OFFO EV Risk Intelligence</Text>
            <Text style={styles.footerSub}>offolabs.com · support@offolabs.com</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.verifyLabel}>Verification token</Text>
            <Text style={styles.verifyToken}>{verification_token}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
