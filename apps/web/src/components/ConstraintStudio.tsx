import React, { useState } from "react";
import { Constraint } from "@chronos/shared";
import { Sparkles, Plus, Trash2, AlertCircle, Bookmark, Zap } from "lucide-react";
import { demoScenarioLoosened, demoScenarioNaiveVsSmart } from "@chronos/solver";

interface ConstraintStudioProps {
  constraints: Constraint[];
  onConstraintsChange: (updated: Constraint[]) => void;
  disabled?: boolean;
}

const PRESETS = [
  {
    name: "Base Dataset (Zero Extra Rules)",
    description: "Trivially solvable with 0 backtracks",
    constraints: [],
    isSignature: false,
  },
  {
    name: "Naive vs Smart Bottleneck Demo",
    description: "KR Mon/Tue + CPP Thu/Fri + Max 1/day (Signature Demo)",
    constraints: demoScenarioNaiveVsSmart,
    isSignature: true,
  },
  {
    name: "Loosened Demo Scenario",
    description: "KR Mon/Tue + CPP Fri + Max 1/day (Solves < 40ms)",
    constraints: demoScenarioLoosened,
    isSignature: false,
  },
];

const SUGGESTIONS = [
  "Prof. Karan Rathi is on leave on Monday and Tuesday",
  "Room 132 is closed for maintenance on Friday morning",
  "At most 1 lecture session of DAA per day for division 5A15-1",
  "Ms. Anjali Pillai prefers teaching in the morning on Wednesday",
];

export const ConstraintStudio: React.FC<ConstraintStudioProps> = ({
  constraints,
  onConstraintsChange,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleParse = async () => {
    if (!inputText.trim() || isParsing) return;
    setIsParsing(true);
    setErrorMsg(null);

    const API_BASE = import.meta.env.VITE_API_URL || "";
    try {
      const response = await fetch(`${API_BASE}/api/constraints/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.constraint) {
        onConstraintsChange([...constraints, data.constraint]);
        setInputText("");
      } else {
        setErrorMsg(data.error || "Failed to parse constraint.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error communicating with constraint parser API.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleToggleConstraint = (id: string) => {
    onConstraintsChange(
      constraints.map((c) =>
        c.id === id
          ? { ...c, type: c.type === "HARD" ? ("SOFT" as any) : "HARD" }
          : c
      )
    );
  };

  const handleDeleteConstraint = (id: string) => {
    onConstraintsChange(constraints.filter((c) => c.id !== id));
  };

  const handleApplyPreset = (presetConstraints: Constraint[]) => {
    onConstraintsChange([...presetConstraints]);
  };

  return (
    <div
      style={{
        background: "#0F1612",
        borderRadius: "8px",
        border: "1px solid #1C2B22",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={16} color="#39FF88" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#EEF8F1", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            NL CONSTRAINT INJECTOR
          </span>
        </div>
        <span
          style={{
            fontSize: "10px",
            background: "rgba(57, 255, 136, 0.1)",
            color: "#39FF88",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: 700,
            border: "1px solid rgba(57, 255, 136, 0.3)",
          }}
        >
          GEMINI 3.6 FLASH
        </span>
      </div>

      {/* Preset Selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span style={{ fontSize: "11px", color: "#7A8D80", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px", textTransform: "uppercase" }}>
          <Bookmark size={12} color="#7A8D80" />
          Benchmark Scenarios:
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {PRESETS.map((preset, idx) => {
            const isSig = preset.isSignature;
            return (
              <button
                key={idx}
                disabled={disabled}
                onClick={() => handleApplyPreset(preset.constraints)}
                style={{
                  background: isSig ? "rgba(57, 255, 136, 0.08)" : "#15201A",
                  border: `1px solid ${isSig ? "#39FF88" : "#1C2B22"}`,
                  borderRadius: "6px",
                  padding: "10px 14px",
                  color: isSig ? "#39FF88" : "#EEF8F1",
                  fontSize: "11px",
                  fontWeight: isSig ? 700 : 500,
                  cursor: disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  boxShadow: isSig ? "0 0 12px rgba(57, 255, 136, 0.2)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                title={preset.description}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {isSig && <Zap size={13} fill="#39FF88" color="#39FF88" />}
                  <span>{preset.name}</span>
                </div>
                {isSig && (
                  <span style={{ fontSize: "9px", background: "#39FF88", color: "#0A0E0C", padding: "1px 6px", borderRadius: "3px", fontWeight: 800 }}>
                    DEMO
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Natural Language Input */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={inputText}
            disabled={disabled || isParsing}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleParse()}
            placeholder="Type constraint rule (e.g. Prof. Karan Rathi is on leave Monday)..."
            style={{
              flex: 1,
              background: "#0A0E0C",
              border: "1px solid #1C2B22",
              borderRadius: "6px",
              padding: "10px 12px",
              color: "#EEF8F1",
              fontSize: "11px",
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
            }}
          />
          <button
            onClick={handleParse}
            disabled={disabled || isParsing || !inputText.trim()}
            style={{
              background: isParsing || !inputText.trim() ? "#15201A" : "#39FF88",
              color: isParsing || !inputText.trim() ? "#4B5A50" : "#0A0E0C",
              border: `1px solid ${isParsing || !inputText.trim() ? "#1C2B22" : "#39FF88"}`,
              borderRadius: "6px",
              padding: "10px 14px",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: isParsing || !inputText.trim() ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              boxShadow: !inputText.trim() ? "none" : "0 0 10px rgba(57, 255, 136, 0.3)",
            }}
          >
            {isParsing ? (
              <span>PARSING...</span>
            ) : (
              <>
                <Plus size={14} />
                <span>PARSE</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setInputText(s)}
              disabled={disabled || isParsing}
              style={{
                background: "#0A0E0C",
                border: "1px dashed #1C2B22",
                borderRadius: "4px",
                padding: "4px 8px",
                color: "#7A8D80",
                fontSize: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              + "{s.substring(0, 30)}..."
            </button>
          ))}
        </div>

        {errorMsg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#FF3B3B",
              fontSize: "11px",
              background: "rgba(255, 59, 59, 0.1)",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255, 59, 59, 0.3)",
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Active Constraints List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#7A8D80", fontWeight: 700, textTransform: "uppercase" }}>
            ACTIVE POLICIES ({constraints.length})
          </span>
          {constraints.length > 0 && (
            <button
              onClick={() => onConstraintsChange([])}
              disabled={disabled}
              style={{
                background: "none",
                border: "none",
                color: "#FF3B3B",
                fontSize: "10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              CLEAR ALL
            </button>
          )}
        </div>

        {constraints.length === 0 ? (
          <div
            style={{
              border: "1px dashed #1C2B22",
              borderRadius: "6px",
              padding: "20px 16px",
              textAlign: "center",
              color: "#4B5A50",
              fontSize: "11px",
              lineHeight: "1.4",
            }}
          >
            No active constraints injected. System will execute default institutional baseline parameters.
          </div>
        ) : (
          constraints.map((c) => {
            const rule = (c.structuredRule || {}) as any;
            const isHard = c.type === "HARD";

            return (
              <div
                key={c.id}
                style={{
                  background: "#15201A",
                  border: `1px solid ${isHard ? "#1C2B22" : "#2A3F33"}`,
                  borderRadius: "6px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: "3px",
                        background: isHard ? "rgba(255, 59, 59, 0.15)" : "rgba(57, 255, 136, 0.15)",
                        color: isHard ? "#FF3B3B" : "#39FF88",
                        border: `1px solid ${isHard ? "rgba(255, 59, 59, 0.3)" : "rgba(57, 255, 136, 0.3)"}`,
                      }}
                    >
                      {c.type}
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#EEF8F1" }}>
                      {c.category}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#C5D4CA" }}>{c.description}</span>
                  {rule.days && (
                    <span style={{ fontSize: "10px", color: "#7A8D80" }}>
                      DAYS: {rule.days.join(", ")} {rule.startTimes ? `(${rule.startTimes.join(", ")})` : ""}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => handleToggleConstraint(c.id)}
                    disabled={disabled}
                    style={{
                      background: "transparent",
                      border: "1px solid #1C2B22",
                      borderRadius: "4px",
                      color: "#7A8D80",
                      fontSize: "9px",
                      padding: "3px 7px",
                      cursor: "pointer",
                    }}
                    title="Toggle HARD / SOFT"
                  >
                    TOGGLE
                  </button>
                  <button
                    onClick={() => handleDeleteConstraint(c.id)}
                    disabled={disabled}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#7A8D80",
                      cursor: "pointer",
                      display: "flex",
                      padding: "4px",
                    }}
                    title="Remove Constraint"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
