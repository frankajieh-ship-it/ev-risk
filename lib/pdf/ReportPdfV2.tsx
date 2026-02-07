/**
 * EV-Risk™ V2 PDF Report Template
 *
 * Page 1: Routine Fit Score (primary hero)
 * Page 2: Ownership Risk + Dealer Questions
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  RoutineFitScore,
  OwnershipRiskFlags,
  StressFlag,
  BreakPoint,
  MinimumViableRoutine,
} from "../../types/v2";

export interface ReportPdfV2Data {
  reportId?: string;
  routineFit: RoutineFitScore;
  ownershipRisk: OwnershipRiskFlags;
  vehicle?: { make: string; model: string; year: number; mileage?: number };
  routine: MinimumViableRoutine;
  dealerQuestions: {
    top_3: string[];
    full_list: string[];
    walk_away_triggers: string[];
  };
  generatedAt?: string;
}

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
  reportId: {
    fontSize: 8,
    color: COLORS.gray,
    fontFamily: "Courier",
  },

  // Hero score
  heroSection: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 8,
    textAlign: "center",
  },
  heroScore: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  mentalLoadPill: {
    fontSize: 10,
    padding: "4 12",
    borderRadius: 12,
    alignSelf: "center",
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 8,
    color: COLORS.darkGray,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 4,
  },

  // What breaks first
  wbfItem: {
    marginBottom: 10,
    paddingLeft: 12,
  },
  wbfLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.darkGray,
    marginBottom: 2,
  },
  wbfTrigger: {
    fontSize: 9,
    color: COLORS.gray,
    fontStyle: "italic",
    marginBottom: 4,
  },
  wbfEvidence: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  wbfEvidenceChip: {
    fontSize: 8,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
    padding: "2 6",
    color: COLORS.darkGray,
  },
  wbfPlanB: {
    fontSize: 8,
    color: COLORS.gray,
    marginTop: 3,
    paddingLeft: 8,
  },

  // Stress flags
  flagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    paddingLeft: 8,
  },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    marginRight: 8,
  },
  flagLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.darkGray,
  },
  flagCitation: {
    fontSize: 9,
    color: COLORS.gray,
    fontStyle: "italic",
    marginTop: 1,
  },

  // Confidence
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
  },
  confidencePill: {
    fontSize: 9,
    fontWeight: "bold",
    padding: "3 10",
    borderRadius: 10,
    marginRight: 10,
  },
  confidenceNote: {
    fontSize: 9,
    color: COLORS.gray,
    flex: 1,
  },

  // Ownership risk modules
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  moduleCard: {
    width: "48%",
    padding: 10,
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    marginBottom: 8,
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  moduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  moduleLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.darkGray,
  },
  moduleSummary: {
    fontSize: 9,
    color: COLORS.gray,
    marginTop: 2,
  },

  // Bullet lists
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

  // Divider
  divider: {
    borderBottom: `1px solid ${COLORS.border}`,
    marginVertical: 16,
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

function getScoreColor(score: number): string {
  if (score >= 65) return COLORS.green;
  if (score >= 45) return COLORS.yellow;
  return COLORS.red;
}

function getScoreBg(score: number): string {
  if (score >= 65) return "#f0fdf4";
  if (score >= 45) return "#fefce8";
  return "#fef2f2";
}

function getSeverityColor(severity: StressFlag["severity"]): string {
  if (severity === "high") return COLORS.red;
  if (severity === "medium") return COLORS.yellow;
  return COLORS.green;
}

function getModuleColor(status: string): string {
  if (status === "green") return COLORS.green;
  if (status === "yellow") return COLORS.yellow;
  if (status === "red") return COLORS.red;
  return COLORS.gray;
}

export const ReportPdfV2: React.FC<{ data: ReportPdfV2Data }> = ({ data }) => {
  const { routineFit, ownershipRisk, vehicle, dealerQuestions } = data;
  const scoreColor = getScoreColor(routineFit.score_0_100);
  const scoreBg = getScoreBg(routineFit.score_0_100);

  const mentalLoadLabel = {
    low: "Low mental overhead",
    medium: "Ongoing planning required",
    high: "Frequent attention required",
  }[routineFit.mental_load];

  return (
    <Document>
      {/* PAGE 1: Routine Fit */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>EV Routine Fit Report</Text>
          <Text style={styles.subtitle}>
            {vehicle
              ? `${vehicle.year} ${vehicle.model}`
              : "Routine-only analysis"}
          </Text>
          {data.reportId && (
            <Text style={styles.reportId}>Report ID: {data.reportId}</Text>
          )}
        </View>

        {/* Hero Score */}
        <View style={[styles.heroSection, { backgroundColor: scoreBg }]}>
          <Text style={[styles.heroScore, { color: scoreColor }]}>
            {routineFit.score_0_100}/100
          </Text>
          <Text style={[styles.heroLabel, { color: scoreColor }]}>
            {routineFit.label}
          </Text>
          <Text
            style={[
              styles.mentalLoadPill,
              {
                backgroundColor: COLORS.lightGray,
                color: COLORS.darkGray,
              },
            ]}
          >
            {mentalLoadLabel}
          </Text>
        </View>

        {/* What Breaks First — Ranked Breakpoints */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Breaks First</Text>
          {routineFit.breakpoints_ranked.map((bp: BreakPoint, i: number) => (
            <View key={bp.id} style={styles.wbfItem}>
              <Text style={[styles.wbfLabel, { color: i === 0 ? COLORS.red : COLORS.yellow }]}>
                #{i + 1} {bp.title}
              </Text>
              <Text style={styles.wbfTrigger}>{bp.trigger}</Text>
              <View style={styles.wbfEvidence}>
                {bp.evidence.map((ev: { label: string; value: string }, j: number) => (
                  <Text key={j} style={styles.wbfEvidenceChip}>
                    {ev.label}: {ev.value}
                  </Text>
                ))}
              </View>
              {i === 0 && (
                <Text style={styles.wbfPlanB}>
                  Plan B: {bp.fallback_plan_b.anchor}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Stress Flags */}
        {routineFit.stress_flags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stress Flags</Text>
            {routineFit.stress_flags.map((flag, i) => (
              <View key={i} style={styles.flagRow}>
                <View
                  style={[
                    styles.flagDot,
                    { backgroundColor: getSeverityColor(flag.severity) },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagLabel}>{flag.label}</Text>
                  <Text style={styles.flagCitation}>
                    {flag.routine_citation}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Confidence */}
        <View style={styles.confidenceRow}>
          <Text
            style={[
              styles.confidencePill,
              {
                backgroundColor:
                  routineFit.confidence.level === "high"
                    ? "#dcfce7"
                    : routineFit.confidence.level === "medium"
                    ? "#fef9c3"
                    : COLORS.lightGray,
                color:
                  routineFit.confidence.level === "high"
                    ? COLORS.green
                    : routineFit.confidence.level === "medium"
                    ? COLORS.yellow
                    : COLORS.gray,
              },
            ]}
          >
            {routineFit.confidence.level === "high"
              ? "High confidence"
              : routineFit.confidence.level === "medium"
              ? "Medium confidence"
              : "Low confidence"}
          </Text>
          <Text style={styles.confidenceNote}>
            {routineFit.confidence.note}
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

      {/* PAGE 2: Ownership Risk + Dealer Questions */}
      <Page size="A4" style={styles.page}>
        {/* Ownership Risk Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ownership Risk Overview</Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "bold",
              marginBottom: 12,
              color:
                ownershipRisk.overall_risk_label === "Low Risk"
                  ? COLORS.green
                  : ownershipRisk.overall_risk_label === "Moderate Risk"
                  ? COLORS.yellow
                  : ownershipRisk.overall_risk_label === "High Risk"
                  ? COLORS.red
                  : COLORS.gray,
            }}
          >
            Overall: {ownershipRisk.overall_risk_label}
          </Text>

          {/* Module cards */}
          <View style={styles.moduleGrid}>
            {ownershipRisk.modules.map((mod, i) => (
              <View key={i} style={styles.moduleCard}>
                <View style={styles.moduleHeader}>
                  <View
                    style={[
                      styles.moduleDot,
                      { backgroundColor: getModuleColor(mod.status) },
                    ]}
                  />
                  <Text style={styles.moduleLabel}>{mod.label}</Text>
                </View>
                <Text style={styles.moduleSummary}>{mod.summary}</Text>
                {mod.detail && (
                  <Text
                    style={[styles.moduleSummary, { marginTop: 4, fontSize: 8 }]}
                  >
                    {mod.detail}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Priority Dealer Questions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority Questions to Ask</Text>
          {dealerQuestions.top_3.map((q, i) => (
            <View key={i} style={styles.bulletPoint}>
              <Text style={[styles.bulletSymbol, { color: COLORS.blue }]}>
                {i + 1}.
              </Text>
              <Text>{q}</Text>
            </View>
          ))}
        </View>

        {/* Full Question List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Question List</Text>
          {dealerQuestions.full_list.map((q, i) => (
            <View key={i} style={styles.bulletPoint}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text>{q}</Text>
            </View>
          ))}
        </View>

        {/* Walk-Away Triggers */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.red }]}>
            Walk-Away Triggers
          </Text>
          {dealerQuestions.walk_away_triggers.map((t, i) => (
            <View key={i} style={styles.bulletPoint}>
              <Text style={[styles.bulletSymbol, { color: COLORS.red }]}>
                !
              </Text>
              <Text>{t}</Text>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View
          style={{
            marginTop: 20,
            padding: 12,
            backgroundColor: COLORS.lightGray,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 9, color: COLORS.gray, lineHeight: 1.5 }}>
            This report is generated based on your stated driving routine and
            publicly available vehicle data. It does not constitute professional
            advice. Always obtain a pre-purchase inspection from a certified EV
            technician before purchasing. Battery condition, recall status, and
            warranty coverage should be verified independently.
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
