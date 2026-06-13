"use client";

import { useState } from "react";
import TestCaseGenerator from "@/components/qa-lab/TestCaseGenerator";
import AutomationScriptGenerator from "@/components/qa-lab/AutomationScriptGenerator";
import DefectReportGenerator from "@/components/qa-lab/DefectReportGenerator";
import ApiTestingStudio from "@/components/qa-lab/ApiTestingStudio";
import CoverageAnalyzer from "@/components/qa-lab/CoverageAnalyzer";

type Tool = "testcases" | "automation" | "defects" | "api" | "coverage";

interface ToolTab {
  id: Tool;
  label: string;
  icon: string;
  description: string;
}

const TOOLS: ToolTab[] = [
  {
    id: "testcases",
    label: "Test Cases",
    icon: "🧪",
    description: "Generate manual test cases from UI descriptions",
  },
  {
    id: "automation",
    label: "Automation",
    icon: "⚡",
    description: "Generate Playwright / Cypress / Selenium scripts",
  },
  {
    id: "defects",
    label: "Defect Report",
    icon: "🐛",
    description: "Turn raw bug descriptions into professional reports",
  },
  {
    id: "api",
    label: "API Testing",
    icon: "🔌",
    description: "Generate positive, negative & boundary API tests",
  },
  {
    id: "coverage",
    label: "Coverage",
    icon: "📊",
    description: "Analyze test coverage against requirements",
  },
];

export default function QALabPage() {
  const [activeTool, setActiveTool] = useState<Tool>("testcases");

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        gap: "20px",
        fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "14px" }}>
        <div>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.15em",
              color: "#00f5ff",
              fontFamily: "var(--font-geist-mono, monospace)",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            QA Engineering Suite
          </div>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "#fff",
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            QA Lab
          </h1>
        </div>
        <div
          style={{
            marginBottom: "4px",
            padding: "3px 10px",
            borderRadius: "4px",
            background: "rgba(0,245,255,0.08)",
            border: "1px solid rgba(0,245,255,0.2)",
            fontSize: "11px",
            color: "#00f5ff",
            fontFamily: "var(--font-geist-mono, monospace)",
            letterSpacing: "0.08em",
          }}
        >
          AI-POWERED
        </div>
      </div>

      {/* Sub-tool navigation */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px",
                border: isActive
                  ? "1px solid rgba(0,245,255,0.5)"
                  : "1px solid #222",
                background: isActive
                  ? "rgba(0,245,255,0.08)"
                  : "rgba(255,255,255,0.02)",
                color: isActive ? "#00f5ff" : "#888",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: "16px" }}>{tool.icon}</span>
              {tool.label}
            </button>
          );
        })}
      </div>

      {/* Active tool description */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid #1a1a1a",
          color: "#666",
          fontSize: "13px",
        }}
      >
        {TOOLS.find((t) => t.id === activeTool)?.icon}{" "}
        {TOOLS.find((t) => t.id === activeTool)?.description}
      </div>

      {/* Tool panel */}
      <div style={{ flex: 1 }}>
        {activeTool === "testcases" && <TestCaseGenerator />}
        {activeTool === "automation" && <AutomationScriptGenerator />}
        {activeTool === "defects" && <DefectReportGenerator />}
        {activeTool === "api" && <ApiTestingStudio />}
        {activeTool === "coverage" && <CoverageAnalyzer />}
      </div>
    </div>
  );
}