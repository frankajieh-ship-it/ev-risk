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

  // FREE VERSION: Routine Fit Assessment
  routineFit?: {
    verdict: 'good-fit' | 'conditional-fit' | 'high-friction';
    condition?: string;
    mental_load: 'low' | 'medium' | 'high';
    reasons: Array<{
      text: string;
      type: 'positive' | 'neutral' | 'negative';
    }>;
    confidence_current: number;
    confidence_with_battery_data: number;
    missing_data: string[];
  };
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
  feedbackSection: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    borderLeft: `4px solid ${COLORS.green}`,
  },
  feedbackTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: COLORS.darkGray,
  },
  feedbackText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.darkGray,
    marginBottom: 6,
  },
  feedbackLink: {
    fontSize: 10,
    color: "#2563eb",
    textDecoration: "underline",
    marginTop: 4,
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

  // Routine fit verdict config
  const verdictConfig = data.routineFit ? {
    'good-fit': {
      emoji: '✅',
      title: 'Good Fit',
      description: 'This EV is likely to fit your routine with low ongoing friction.',
      color: COLORS.green
    },
    'conditional-fit': {
      emoji: '⚠️',
      title: 'Conditional Fit',
      description: data.routineFit.condition
        ? `This EV can work, but only if you ${data.routineFit.condition} consistently.`
        : 'This EV can work with certain conditions met.',
      color: COLORS.yellow
    },
    'high-friction': {
      emoji: '❌',
      title: 'High Friction Risk',
      description: 'This setup is likely to become annoying or stressful over time.',
      color: COLORS.red
    }
  }[data.routineFit.verdict] : null;

  // Mental load config
  const mentalLoadConfig = data.routineFit ? {
    'low': { emoji: '🟢', label: 'Low mental overhead' },
    'medium': { emoji: '🟡', label: 'Ongoing planning required' },
    'high': { emoji: '🔴', label: 'Frequent attention required' }
  }[data.routineFit.mental_load] : null;

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

        {/* FREE VERSION: ROUTINE FIT ASSESSMENT */}
        {data.routineFit && verdictConfig && (
          <>
            {/* 1️⃣ ONE-LINE VERDICT */}
            <View style={styles.scoreSection}>
              <Text style={[styles.scoreTitle, { color: verdictConfig.color }]}>
                {verdictConfig.emoji} {verdictConfig.title}
              </Text>
              <Text style={styles.verdict}>{verdictConfig.description}</Text>
              <Text style={[styles.bulletPoint, { fontSize: 9, marginTop: 8, paddingLeft: 0 }]}>
                ⚠️ This is not a recommendation to buy or avoid — it's a routine fit signal.
              </Text>
            </View>

            {/* 2️⃣ WHY THIS RESULT */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why This Result</Text>
              {data.routineFit.reasons.map((reason, index) => {
                const icon = reason.type === 'positive' ? '✓' : reason.type === 'negative' ? '✗' : '•';
                return (
                  <View key={index} style={styles.bulletPoint}>
                    <Text style={styles.bulletSymbol}>{icon}</Text>
                    <Text>{reason.text}</Text>
                  </View>
                );
              })}
            </View>

            {/* 3️⃣ MENTAL LOAD INDICATOR */}
            {mentalLoadConfig && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mental Load Indicator</Text>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bulletSymbol}>{mentalLoadConfig.emoji}</Text>
                  <Text style={{ fontWeight: 'bold' }}>{mentalLoadConfig.label}</Text>
                </View>
              </View>
            )}

            {/* 4️⃣ WHAT'S MISSING - Trust Builder */}
            <View style={[styles.section, { marginBottom: 30 }]}>
              <Text style={styles.sectionTitle}>What's Missing</Text>
              <Text style={[styles.bulletPoint, { paddingLeft: 0, marginBottom: 10 }]}>
                Current confidence: {data.routineFit.confidence_current}% → With battery data: {data.routineFit.confidence_with_battery_data}%
                ({data.routineFit.confidence_with_battery_data - data.routineFit.confidence_current}% increase)
              </Text>
              <Text style={[styles.scoreTitle, { fontSize: 11, marginBottom: 6 }]}>Missing data points:</Text>
              {data.routineFit.missing_data.map((item, index) => (
                <View key={index} style={styles.bulletPoint}>
                  <Text style={styles.bulletSymbol}>•</Text>
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* LEGACY Score Section - Will be deprecated in Phase 0.5 full implementation */}
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

        {/* Feedback Section */}
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackTitle}>📣 Help Us Improve</Text>
          <Text style={styles.feedbackText}>
            Your feedback helps us make EV-Risk™ more accurate and useful for everyone.
          </Text>
          <Text style={styles.feedbackText}>
            • Was this report helpful in your decision-making process?
          </Text>
          <Text style={styles.feedbackText}>
            • Did you find any information missing or inaccurate?
          </Text>
          <Text style={styles.feedbackText}>
            • What additional data points would have been valuable?
          </Text>
          <Text style={styles.feedbackLink}>
            Share your feedback: https://offolab.com/feedback
          </Text>
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
