// components/ReportView.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BlockRenderer } from "@/components/BlockRenderer";
import { RenderCtx, Block } from "@/core/content";
import { getBlocks, buildSignals } from "@/core/blocks/sampleBlocks";
import { lintVoice } from "@/debug/voiceLinter";
import { confTrace, isDebugEnabled, voiceTrace } from "@/debug/confTrace";
import {
  Battery, Shield, TrendingUp, AlertTriangle,
  CheckCircle, Download,
  Share2, Printer, Clock,
  DollarSign, Zap, MapPin,
  ChevronRight, ChevronDown, Sparkles, Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReportViewProps {
  vehicle: any;
  userInputs?: any;
  onProvide?: (key: string, value: any) => void;
  riskScore?: number;
  confidence?: number;
}

export const ReportView: React.FC<ReportViewProps> = ({
  vehicle,
  userInputs,
  onProvide,
  riskScore = 75,
  confidence = 85
}) => {
  const prevConfRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [exporting, setExporting] = useState(false);
  const [showDetails, setShowDetails] = useState<string[]>([]);

  const ctx: RenderCtx = useMemo(() => {
    const signals = buildSignals(vehicle, userInputs);
    return { vehicle, inputs: userInputs, signals };
  }, [vehicle, userInputs]);

  const blocks = useMemo(() => getBlocks(ctx), [ctx]);

  // Group blocks by category for better organization
  const categorizedBlocks = useMemo(() => {
    const categories: Record<string, Block[]> = {
      overview: [],
      battery: [],
      financial: [],
      recommendations: [],
      risks: [],
      details: []
    };

    blocks.forEach(block => {
      // Simple categorization logic - expand based on your block types
      if (block.id.includes('battery') || block.id.includes('health')) {
        categories.battery.push(block);
      } else if (block.id.includes('cost') || block.id.includes('price')) {
        categories.financial.push(block);
      } else if (block.id.includes('risk') || block.id.includes('warning')) {
        categories.risks.push(block);
      } else if (block.id.includes('recommend') || block.id.includes('action')) {
        categories.recommendations.push(block);
      } else if (block.id.includes('detail') || block.id.includes('spec')) {
        categories.details.push(block);
      } else {
        categories.overview.push(block);
      }
    });

    return categories;
  }, [blocks]);

  // Confidence tracing (Task C)
  useEffect(() => {
    if (!isDebugEnabled()) return;

    const dominantTier = blocks.length ? blocks[0].tier : 4;
    const confValues = blocks.map(b => b.confidence(ctx));
    const overall = confValues.length ?
      confValues.reduce((a, b) => a + b, 0) / confValues.length : 0;

    const prev = prevConfRef.current;
    if (prev == null) {
      confTrace({
        kind: "initial",
        overall,
        dominantTier,
        missingSignals: missingSignalsFromBlocks(blocks, ctx),
        blocks: blocks.map(b => ({ id: b.id, tier: b.tier, conf: b.confidence(ctx) })),
      });
    } else if (Math.abs(prev - overall) > 0.001) {
      confTrace({
        kind: "change",
        from: prev,
        to: overall,
        dominantTier,
        missingSignals: missingSignalsFromBlocks(blocks, ctx),
        blocks: blocks.map(b => ({ id: b.id, tier: b.tier, conf: b.confidence(ctx) })),
      });
    }
    prevConfRef.current = overall;
  }, [blocks, ctx]);

  // Voice linting (Task B)
  useEffect(() => {
    if (!isDebugEnabled()) return;

    const fullText = blocks.map(b => {
      if (b.kind === "text") return b.render(ctx);
      const metricText = b.render ? b.render(ctx) : "";
      return `${b.metric(ctx).label}: ${b.metric(ctx).value}. ${metricText}`;
    }).join("\n");

    const res = lintVoice(fullText);
    if (!res.ok) {
      voiceTrace({ kind: "lint_failed", hits: res.hits });
      console.warn("[EV-RISK VOICE] Lint failed:", res.hits);
    } else {
      voiceTrace({ kind: "lint_ok" });
    }
  }, [blocks, ctx]);

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return "Low Risk";
    if (score >= 60) return "Moderate Risk";
    if (score >= 40) return "Elevated Risk";
    return "High Risk";
  };

  const handleExport = async () => {
    setExporting(true);
    // Implement export logic
    setTimeout(() => setExporting(false), 1500);
  };

  const toggleDetail = (id: string) => {
    setShowDetails(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Report Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">EV-Risk Report</h1>
                  <p className="text-xs text-gray-500">
                    Generated {new Date().toLocaleDateString()} • ID: {Date.now().toString(36).toUpperCase()}
                  </p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full border ${getRiskColor(riskScore)}`}>
                <span className="text-sm font-semibold">{getRiskLevel(riskScore)}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleExport()}
                disabled={exporting}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? "Exporting..." : "Export"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:shadow-lg"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Stats Banner */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            {
              icon: Battery,
              label: "Battery Health",
              value: "92%",
              subtext: "Excellent",
              color: "green"
            },
            {
              icon: DollarSign,
              label: "5-Year Cost",
              value: "$18,240",
              subtext: "Savings vs. New",
              color: "blue"
            },
            {
              icon: Shield,
              label: "Warranty",
              value: "2.5 years",
              subtext: "Remaining",
              color: "purple"
            },
            {
              icon: TrendingUp,
              label: "Market Score",
              value: "8.2/10",
              subtext: "Good Deal",
              color: "amber"
            }
          ].map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full bg-${stat.color}-100 text-${stat.color}-700`}>
                  {stat.subtext}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Report */}
          <div className="lg:col-span-2">
            {/* Risk Score Visualization */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Overall Risk Assessment</h2>
                  <p className="text-gray-600">Based on battery health, market data, and ownership costs</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-gray-900">{riskScore}/100</div>
                  <div className={`text-sm font-semibold ${getRiskColor(riskScore).split(' ')[0]}`}>
                    {getRiskLevel(riskScore)}
                  </div>
                </div>
              </div>

              {/* Risk Score Bar */}
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${riskScore}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className={`absolute h-full rounded-full ${
                    riskScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    riskScore >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                    'bg-gradient-to-r from-red-500 to-orange-500'
                  }`}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>High Risk</span>
                <span>Moderate</span>
                <span>Low Risk</span>
              </div>

              {/* Confidence Indicator */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Report Confidence</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden mr-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${confidence}%` }}
                        transition={{ duration: 1, delay: 0.7 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900">{confidence}%</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-8">
              {['overview', 'battery', 'financial', 'risks', 'recommendations'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSection(tab)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all capitalize ${
                    activeSection === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Dynamic Content Sections */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {categorizedBlocks[activeSection]?.map((block) => (
                  <div key={block.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <BlockRenderer
                      block={block}
                      ctx={ctx}
                      onProvide={onProvide}
                    />
                    {block.id.includes('detail') && (
                      <button
                        onClick={() => toggleDetail(block.id)}
                        className="flex items-center text-sm text-blue-600 mt-4"
                      >
                        {showDetails.includes(block.id) ? (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-4 h-4 mr-1" />
                            Show Details
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Action Cards */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8"
            >
              {[
                {
                  title: "Next Steps",
                  icon: CheckCircle,
                  color: "green",
                  actions: [
                    "Schedule pre-purchase inspection",
                    "Verify battery warranty transfer",
                    "Test fast charging capability"
                  ]
                },
                {
                  title: "Critical Actions",
                  icon: AlertTriangle,
                  color: "red",
                  actions: [
                    "Check for open recalls",
                    "Verify charging cable compatibility",
                    "Review service history gaps"
                  ]
                }
              ].map((card, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="bg-white rounded-xl border border-gray-200 p-6"
                >
                  <div className="flex items-center mb-4">
                    <div className={`w-10 h-10 rounded-lg bg-${card.color}-50 flex items-center justify-center mr-3`}>
                      <card.icon className={`w-5 h-5 text-${card.color}-600`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {card.actions.map((action, i) => (
                      <li key={i} className="flex items-center text-sm text-gray-700">
                        <div className={`w-2 h-2 rounded-full bg-${card.color}-500 mr-3`} />
                        {action}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Vehicle Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Model</span>
                  <span className="text-sm font-medium text-gray-900">{vehicle?.model || 'Tesla Model 3'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Year</span>
                  <span className="text-sm font-medium text-gray-900">{vehicle?.year || '2021'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Mileage</span>
                  <span className="text-sm font-medium text-gray-900">
                    {vehicle?.mileage?.toLocaleString() || '36,000'} mi
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Location</span>
                  <span className="text-sm font-medium text-gray-900">{vehicle?.location || 'San Francisco, CA'}</span>
                </div>
              </div>
            </motion.div>

            {/* Quick Insights */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
              <div className="space-y-4">
                {[
                  { icon: Zap, text: "Excellent fast charging capability", color: "green" },
                  { icon: Users, text: "High owner satisfaction rating", color: "blue" },
                  { icon: Clock, text: "Low maintenance requirements", color: "purple" },
                  { icon: MapPin, text: "Good charging infrastructure in area", color: "amber" },
                ].map((insight, index) => (
                  <div key={index} className="flex items-start">
                    <div className={`w-8 h-8 rounded-lg bg-${insight.color}-100 flex items-center justify-center mr-3 flex-shrink-0`}>
                      <insight.icon className={`w-4 h-4 text-${insight.color}-600`} />
                    </div>
                    <span className="text-sm text-gray-700">{insight.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Confidence Factors */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confidence Factors</h3>
              <div className="space-y-3">
                {[
                  { label: "Data Completeness", value: 92, color: "green" },
                  { label: "Market Data Freshness", value: 88, color: "blue" },
                  { label: "Owner Reports", value: 76, color: "amber" },
                  { label: "Model History", value: 94, color: "green" },
                ].map((factor, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{factor.label}</span>
                      <span className="font-medium text-gray-900">{factor.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.value}%` }}
                        transition={{ duration: 1, delay: 0.7 + index * 0.1 }}
                        className={`h-full bg-${factor.color}-500`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Download Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-3">Share This Report</h3>
              <p className="text-sm text-gray-300 mb-4">
                Share this comprehensive analysis with your mechanic, dealer, or financing partner.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleExport()}
                  className="w-full flex items-center justify-center py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF Report
                </button>
                <button className="w-full flex items-center justify-center py-3 bg-gray-800 border border-gray-700 text-white rounded-lg font-semibold hover:bg-gray-700">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Report
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 pt-8 border-t border-gray-200"
        >
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Important Disclaimer</span>
            </div>
            <p className="text-sm text-gray-600 max-w-3xl mx-auto">
              This report is based on available data and statistical models. It does not replace a professional
              inspection by a certified EV technician. Always verify critical details before purchasing.
              Report generated on {new Date().toLocaleDateString()} using EV-Risk AI v2.1.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

function missingSignalsFromBlocks(blocks: Block[], ctx: RenderCtx): string[] {
  const missing = new Set<string>();
  for (const b of blocks) {
    for (const req of (b.requiredSignals ?? [])) {
      const present = Boolean(ctx.signals?.[req]);
      if (!present) missing.add(req);
    }
  }
  return Array.from(missing);
}
