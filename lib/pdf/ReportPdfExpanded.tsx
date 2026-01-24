/**
 * EV-Risk Expanded PDF Report Template
 *
 * Design Principle: PDF = explanation ("why" in detail)
 * Contains ALL content removed from web page
 *
 * 10 Sections:
 * 1. Executive Summary
 * 2. Mental Load & Routine Impact
 * 3. What Breaks First (expanded)
 * 4. History x Routine Interaction
 * 5. Confidence Breakdown
 * 6. Missing Data & What It Would Change
 * 7. Cost/Battery/Degradation
 * 8. Appendix
 * 9. Seasonal Friction (P0/P1 - conditional)
 * 10. Charging Predictability Analysis (P0/P1 - conditional)
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PdfPresentation } from "@/types/presentation";

// Extended payload interface
export interface ExpandedReportPayload extends PdfPresentation {
  reportId: string;
  vehicleYear?: number;
  vehicleModel?: string;
  // Legacy fields for backward compatibility
  dealerQuestions?: string[];
  walkAwayTriggers?: string[];
}

// Color scheme
const COLORS = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
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
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 8,
  },
  reportId: {
    fontSize: 9,
    color: COLORS.gray,
    fontFamily: "Courier",
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
  subsectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 10,
    color: COLORS.darkGray,
  },
  verdictBox: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
  },
  fitSignalText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  verdictText: {
    fontSize: 11,
    lineHeight: 1.5,
    color: COLORS.darkGray,
  },
  mentalLoadBadge: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#ffffff",
    borderRadius: 4,
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
  expandedItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
    color: COLORS.darkGray,
  },
  itemBody: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.darkGray,
  },
  signalBox: {
    marginBottom: 10,
    padding: 10,
    borderLeft: `3px solid ${COLORS.blue}`,
    backgroundColor: COLORS.lightGray,
  },
  signalType: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  confidenceDriver: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
  },
  driverCategory: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  driverStrength: {
    fontSize: 9,
    color: COLORS.gray,
    marginBottom: 4,
  },
  missingItem: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
  },
  missingField: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  missingImportance: {
    fontSize: 9,
    color: COLORS.gray,
    marginBottom: 4,
  },
  howToFind: {
    fontSize: 9,
    fontStyle: "italic",
    color: COLORS.gray,
    marginTop: 4,
  },
  scoreBox: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  appendixItem: {
    fontSize: 9,
    marginBottom: 4,
    paddingLeft: 10,
    color: COLORS.gray,
    lineHeight: 1.4,
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
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: COLORS.gray,
  },
});

// Helper to get fit signal color
function getFitSignalColor(fitSignal: string): string {
  if (fitSignal === "Good Fit" || fitSignal === "Good Fit — with conditions") {
    return COLORS.green;
  } else if (fitSignal === "Conditional Fit") {
    return COLORS.yellow;
  }
  return COLORS.red;
}

// Helper to get signal type color
function getSignalTypeColor(type: string): string {
  if (type === "friction") return COLORS.red;
  if (type === "buffer") return COLORS.green;
  return COLORS.blue;
}

export const ReportPdfExpanded: React.FC<{ data: ExpandedReportPayload }> = ({
  data,
}) => {
  const fitSignalColor = getFitSignalColor(data.fitSignal);

  return (
    <Document>
      {/* PAGE 1: Executive Summary + Mental Load */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>EV-Risk Full Report</Text>
          <Text style={styles.subtitle}>
            {data.vehicleYear} {data.vehicleModel}
          </Text>
          <Text style={styles.reportId}>Report ID: {data.reportId}</Text>
        </View>

        {/* Section 1: Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Executive Summary</Text>
          <View style={styles.verdictBox}>
            <Text style={[styles.fitSignalText, { color: fitSignalColor }]}>
              {data.fitSignal}
            </Text>
            <Text style={styles.verdictText}>{data.oneSentenceVerdict}</Text>
            <View style={styles.mentalLoadBadge}>
              <Text style={{ fontSize: 10, color: COLORS.darkGray }}>
                Mental Load: {data.mentalLoadLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.appendixItem, { paddingLeft: 0, fontSize: 9 }]}>
            This is not a recommendation to buy or avoid — it explains how this
            EV will feel in your routine.
          </Text>
        </View>

        {/* Section 2: Mental Load & Routine Impact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            2. Mental Load & Routine Impact
          </Text>
          <View style={styles.expandedItem}>
            <Text style={styles.itemTitle}>
              {data.mentalLoadDetails.label}
            </Text>
            <Text style={styles.itemBody}>
              {data.mentalLoadDetails.description}
            </Text>
          </View>
          <Text style={styles.subsectionTitle}>Why This Matters</Text>
          <Text style={styles.itemBody}>{data.mentalLoadDetails.whyItMatters}</Text>

          {data.mentalLoadDetails.practicalImplications.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Practical Implications</Text>
              {data.mentalLoadDetails.practicalImplications.map((impl, idx) => (
                <View key={idx} style={styles.bulletPoint}>
                  <Text style={styles.bulletSymbol}>•</Text>
                  <Text>{impl}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Section 3: What Breaks First (expanded) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. What Breaks First</Text>
          <Text style={[styles.itemBody, { marginBottom: 10 }]}>
            These are the most likely friction points based on your routine and
            this vehicle's characteristics.
          </Text>
          {data.whatBreaksFirstExpanded.map((item, idx) => (
            <View key={idx} style={styles.expandedItem}>
              <Text style={styles.itemTitle}>{item.item}</Text>
              <Text style={styles.itemBody}>{item.explanation}</Text>
              {item.timeline && (
                <Text style={[styles.howToFind, { marginTop: 6 }]}>
                  Timeline: {item.timeline}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by EV-Risk | This report is for informational purposes
            only
          </Text>
        </View>
      </Page>

      {/* PAGE 2: History x Routine + Confidence */}
      <Page size="A4" style={styles.page}>
        {/* Section 4: History x Routine Interaction */}
        {data.historyRoutineSignals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              4. History × Routine Interaction
            </Text>
            <Text style={[styles.itemBody, { marginBottom: 10 }]}>
              How this vehicle's history will interact with your daily routine.
            </Text>
            {data.historyRoutineSignals.map((signal, idx) => (
              <View
                key={idx}
                style={[
                  styles.signalBox,
                  { borderLeftColor: getSignalTypeColor(signal.type) },
                ]}
              >
                <Text
                  style={[
                    styles.signalType,
                    { color: getSignalTypeColor(signal.type) },
                  ]}
                >
                  {signal.type} — {signal.impact} Impact
                </Text>
                <Text style={[styles.itemTitle, { marginBottom: 4 }]}>
                  {signal.headline}
                </Text>
                <Text style={styles.itemBody}>{signal.explanation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 5: Confidence Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Confidence Breakdown</Text>
          <View style={styles.verdictBox}>
            <Text style={styles.itemTitle}>
              Overall Confidence: {data.confidenceBreakdown.overall}
            </Text>
            <Text style={styles.itemBody}>
              {data.confidenceBreakdown.overallNote}
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Confidence Drivers</Text>

          <View style={styles.confidenceDriver}>
            <Text style={styles.driverCategory}>Data Completeness</Text>
            <Text style={styles.driverStrength}>
              Strength: {data.confidenceBreakdown.dataCompleteness.strength}
            </Text>
            <Text style={styles.itemBody}>
              {data.confidenceBreakdown.dataCompleteness.reason}
            </Text>
          </View>

          <View style={styles.confidenceDriver}>
            <Text style={styles.driverCategory}>History Clarity</Text>
            <Text style={styles.driverStrength}>
              Strength: {data.confidenceBreakdown.historyClarity.strength}
            </Text>
            <Text style={styles.itemBody}>
              {data.confidenceBreakdown.historyClarity.reason}
            </Text>
          </View>

          <View style={styles.confidenceDriver}>
            <Text style={styles.driverCategory}>Routine Predictability</Text>
            <Text style={styles.driverStrength}>
              Strength:{" "}
              {data.confidenceBreakdown.routinePredictability.strength}
            </Text>
            <Text style={styles.itemBody}>
              {data.confidenceBreakdown.routinePredictability.reason}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by EV-Risk | This report is for informational purposes
            only
          </Text>
        </View>
      </Page>

      {/* PAGE 3: Missing Data + Cost/Battery */}
      <Page size="A4" style={styles.page}>
        {/* Section 6: Missing Data & What It Would Change */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            6. Missing Data & What It Would Change
          </Text>
          <View style={styles.verdictBox}>
            <Text style={styles.itemBody}>
              Current confidence: {data.currentConfidence}% → With battery data:{" "}
              {data.confidenceWithBatteryData}% (+
              {data.confidenceWithBatteryData - data.currentConfidence}%
              improvement)
            </Text>
          </View>

          {data.missingData.map((item, idx) => (
            <View key={idx} style={styles.missingItem}>
              <Text style={styles.missingField}>{item.field}</Text>
              <Text style={styles.missingImportance}>
                Importance: {item.importance}
              </Text>
              <Text style={styles.itemBody}>{item.whyItMatters}</Text>
              <Text style={styles.howToFind}>How to find: {item.howToFind}</Text>
            </View>
          ))}
        </View>

        {/* Section 7: Cost/Battery/Degradation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Battery & Cost Details</Text>

          <View style={styles.scoreBox}>
            <Text style={styles.itemTitle}>Numeric Assessment Score</Text>
            <Text style={[styles.scoreValue, { color: COLORS.darkGray }]}>
              {data.numericScore}/100
            </Text>
            <Text style={[styles.appendixItem, { paddingLeft: 0 }]}>
              This score provides context, not a rating. Higher = lower friction.
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Battery Details</Text>
          <View style={styles.expandedItem}>
            <Text style={styles.itemBody}>
              Chemistry: {data.batteryDetails.chemistry}
            </Text>
            <Text style={styles.itemBody}>
              Estimated Degradation: {data.batteryDetails.degradationPercent}%
            </Text>
            <Text style={styles.itemBody}>
              Estimated Replacement Cost: $
              {data.batteryDetails.estimatedReplacementCost.toLocaleString()}
            </Text>
            <Text style={[styles.itemBody, { marginTop: 6 }]}>
              {data.batteryDetails.healthContext}
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Platform Details</Text>
          <View style={styles.expandedItem}>
            <Text style={styles.itemBody}>
              Total Recalls: {data.platformDetails.totalRecalls}
            </Text>
            <Text style={styles.itemBody}>
              Critical Recalls: {data.platformDetails.criticalRecalls}
            </Text>
            <Text style={styles.itemBody}>
              Reliability Score: {data.platformDetails.reliabilityScore}%
            </Text>
          </View>
        </View>

        {/* Top Drivers with Impact (moved from web) */}
        {data.topDriversWithImpact.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>All Top Drivers</Text>
            {data.topDriversWithImpact.map((driver, idx) => (
              <View key={idx} style={styles.bulletPoint}>
                <Text style={styles.bulletSymbol}>•</Text>
                <Text>
                  {driver.label} ({driver.impact} impact)
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Full Plan B (moved from web) */}
        {data.fullPlanB.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>
              Complete "Plan B" Strategies
            </Text>
            {data.fullPlanB.map((item, idx) => (
              <View key={idx} style={styles.bulletPoint}>
                <Text style={styles.bulletSymbol}>✓</Text>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by EV-Risk | This report is for informational purposes
            only
          </Text>
        </View>
      </Page>

      {/* PAGE 4: Seasonal & Predictability (P0/P1) */}
      {(data.seasonalFriction || data.predictabilityAnalysis) && (
        <Page size="A4" style={styles.page}>
          {/* Section 9: Seasonal Friction */}
          {data.seasonalFriction && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                9. Seasonal Friction: What Changes and Why
              </Text>

              <View style={[styles.verdictBox, { borderLeftWidth: 4, borderLeftColor: data.seasonalFriction.sensitivity === "HIGH" ? COLORS.red : COLORS.yellow }]}>
                <Text style={[styles.fitSignalText, { color: data.seasonalFriction.sensitivity === "HIGH" ? COLORS.red : COLORS.yellow, fontSize: 13 }]}>
                  {data.seasonalFriction.sensitivity === "HIGH" ? "❄️ High" : "❄️ Medium"} Seasonal Sensitivity
                </Text>
                <Text style={styles.verdictText}>{data.seasonalFriction.headline}</Text>
              </View>

              <Text style={styles.itemBody}>{data.seasonalFriction.explanation}</Text>

              <Text style={styles.subsectionTitle}>What Changes in Winter</Text>
              {data.seasonalFriction.whatChanges.map((item, idx) => (
                <View key={idx} style={styles.bulletPoint}>
                  <Text style={styles.bulletSymbol}>•</Text>
                  <Text>{item}</Text>
                </View>
              ))}

              <Text style={styles.subsectionTitle}>Buffer Guidance</Text>
              <View style={styles.expandedItem}>
                <Text style={styles.itemBody}>{data.seasonalFriction.bufferGuidance}</Text>
              </View>

              {data.seasonalFriction.triggerTags.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Trigger Tags</Text>
                  <Text style={[styles.appendixItem, { paddingLeft: 0 }]}>
                    {data.seasonalFriction.triggerTags.join(", ")}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Section 10: Predictability Analysis */}
          {data.predictabilityAnalysis && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                10. Charging Predictability Analysis
              </Text>

              <View style={[styles.verdictBox, { borderLeftWidth: 4, borderLeftColor: data.predictabilityAnalysis.level === "HIGH" ? COLORS.green : data.predictabilityAnalysis.level === "MEDIUM" ? COLORS.yellow : COLORS.red }]}>
                <Text style={[styles.fitSignalText, { color: data.predictabilityAnalysis.level === "HIGH" ? COLORS.green : data.predictabilityAnalysis.level === "MEDIUM" ? COLORS.yellow : COLORS.red, fontSize: 13 }]}>
                  {data.predictabilityAnalysis.level === "HIGH" ? "📍 High" : data.predictabilityAnalysis.level === "MEDIUM" ? "📍 Medium" : "📍 Low"} Predictability
                </Text>
                <Text style={styles.verdictText}>
                  {data.predictabilityAnalysis.backupStatus}
                </Text>
              </View>

              <Text style={styles.itemBody}>{data.predictabilityAnalysis.explanation}</Text>

              {data.predictabilityAnalysis.anchorType && (
                <View style={[styles.expandedItem, { marginTop: 10 }]}>
                  <Text style={styles.itemTitle}>Primary Charging Anchor</Text>
                  <Text style={styles.itemBody}>
                    {data.predictabilityAnalysis.anchorType === "HOME" && "Home — Most reliable anchor. Charging becomes automatic, like plugging in your phone."}
                    {data.predictabilityAnalysis.anchorType === "WORK" && "Workplace — Can be reliable, but depends on employer policies and charger availability."}
                    {data.predictabilityAnalysis.anchorType === "DESTINATION" && "Regular destination — Works if you visit consistently, but less automatic than home."}
                    {data.predictabilityAnalysis.anchorType === "PUBLIC_ANCHOR" && "Public station — Requires active planning and may have variable availability."}
                    {data.predictabilityAnalysis.anchorType === "NONE" && "No primary anchor — Highest friction; requires active planning for every charge."}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text>
              Generated by EV-Risk | This report is for informational purposes
              only
            </Text>
          </View>
        </Page>
      )}

      {/* PAGE 5: Appendix */}
      <Page size="A4" style={styles.page}>
        {/* Section 8: Appendix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Appendix</Text>

          <Text style={styles.subsectionTitle}>Assumptions</Text>
          {data.assumptions.map((item, idx) => (
            <Text key={idx} style={styles.appendixItem}>
              • {item}
            </Text>
          ))}

          <Text style={styles.subsectionTitle}>Disclaimers</Text>
          {data.disclaimers.map((item, idx) => (
            <Text key={idx} style={styles.appendixItem}>
              • {item}
            </Text>
          ))}

          <Text style={styles.subsectionTitle}>Data Sources</Text>
          {data.dataSources.map((item, idx) => (
            <Text key={idx} style={styles.appendixItem}>
              • {item}
            </Text>
          ))}
        </View>

        {/* Dealer Questions (if available) */}
        {data.dealerQuestions && data.dealerQuestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Questions to Ask Dealer</Text>
            {data.dealerQuestions.map((item, idx) => (
              <View key={idx} style={styles.bulletPoint}>
                <Text style={styles.bulletSymbol}>❓</Text>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Walk-Away Triggers (if available) */}
        {data.walkAwayTriggers && data.walkAwayTriggers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Walk-Away Triggers</Text>
            {data.walkAwayTriggers.map((item, idx) => (
              <View key={idx} style={styles.bulletPoint}>
                <Text style={styles.bulletSymbol}>🚩</Text>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Final Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by EV-Risk | This report is for informational purposes
            only
          </Text>
          <Text>© {new Date().getFullYear()} EV-Risk. All rights reserved.</Text>
        </View>
      </Page>
    </Document>
  );
};
