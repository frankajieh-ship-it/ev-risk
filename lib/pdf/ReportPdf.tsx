/**
 * EV-Risk™ PDF Report Template
 * Uses @react-pdf/renderer for PDF generation
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Report payload interface
export interface ReportPayload {
  reportId: string;
  level: "green" | "yellow" | "red";
  score: number;
  summaryVerdict: string;
  batteryRiskExplanation: string[];
  platformRecallRisk: string[];
  ownershipFit: string[];
  dealerQuestions: string[];
  walkAwayTriggers: string[];
  vehicleYear?: number;
  vehicleModel?: string;
}

// Color scheme
const COLORS = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  gray: "#6b7280",
  darkGray: "#374151",
  lightGray: "#f3f4f6",
  border: "#e5e7eb",
};

// Styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: `2px solid ${COLORS.border}`,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 8,
  },
  reportId: {
    fontSize: 9,
    color: COLORS.gray,
    fontFamily: "Courier",
  },
  scoreSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
  },
  scoreTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: COLORS.darkGray,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  verdict: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 1.5,
    color: COLORS.darkGray,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: COLORS.darkGray,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 4,
  },
  bulletPoint: {
    fontSize: 10,
    marginBottom: 6,
    paddingLeft: 15,
    lineHeight: 1.5,
  },
  bulletSymbol: {
    position: "absolute",
    left: 0,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLORS.gray,
    textAlign: "center",
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 10,
  },
});

export const ReportPdf: React.FC<{ data: ReportPayload }> = ({ data }) => {
  const scoreColor =
    data.level === "green"
      ? COLORS.green
      : data.level === "yellow"
      ? COLORS.yellow
      : COLORS.red;

  const levelLabel =
    data.level === "green"
      ? "LOW RISK"
      : data.level === "yellow"
      ? "MEDIUM RISK"
      : "HIGH RISK";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>EV-Risk™ Full Report</Text>
          <Text style={styles.subtitle}>
            {data.vehicleYear} {data.vehicleModel}
          </Text>
          <Text style={styles.reportId}>Report ID: {data.reportId}</Text>
        </View>

        {/* Score Section */}
        <View style={styles.scoreSection}>
          <Text style={styles.scoreTitle}>Overall Risk Score</Text>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>
            {data.score}/100
          </Text>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>
            {levelLabel}
          </Text>
          <Text style={styles.verdict}>{data.summaryVerdict}</Text>
        </View>

        {/* Battery Risk */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            1. Battery Health & Replacement Risk
          </Text>
          {data.batteryRiskExplanation.map((item, index) => (
            <View key={index} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Platform/Recall Risk */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Platform & Recall Risk</Text>
          {data.platformRecallRisk.map((item, index) => (
            <View key={index} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Ownership Fit */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            3. Ownership Fit & Infrastructure
          </Text>
          {data.ownershipFit.map((item, index) => (
            <View key={index} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Dealer Questions */}
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>4. Questions to Ask Dealer</Text>
          {data.dealerQuestions.map((item, index) => (
            <View key={index} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>❓</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Walk-Away Triggers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Walk-Away Triggers</Text>
          {data.walkAwayTriggers.map((item, index) => (
            <View key={index} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>🚩</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by EV-Risk™ | This report is for informational purposes
            only
          </Text>
          <Text>© {new Date().getFullYear()} EV-Risk. All rights reserved.</Text>
        </View>
      </Page>
    </Document>
  );
};
