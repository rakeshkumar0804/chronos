import React, { useState } from "react";
import { ActiveAssignment } from "../hooks/useSolverWorker.js";
import { Calendar, Building, User, Users } from "lucide-react";

interface TimetableGridProps {
  assignments: Map<string, ActiveAssignment>;
  divisions: string[];
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const TIME_SLOTS = [
  { label: "07:30 - 08:30", startTime: "07:30" },
  { label: "08:30 - 09:30", startTime: "08:30" },
  { label: "09:45 - 10:45", startTime: "09:45" },
  { label: "10:45 - 11:45", startTime: "10:45" },
  { label: "12:45 - 13:35", startTime: "12:45" },
  { label: "13:35 - 14:25", startTime: "13:35" },
];

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  assignments,
  divisions,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>(
    divisions[0] || "5A15-1"
  );

  // Group assignments by Day and StartTime for selected division
  const gridMap = new Map<string, ActiveAssignment>();
  for (const assign of assignments.values()) {
    if (assign.divisionName === selectedDivision) {
      const key = `${assign.value.timeSlotDay}_${assign.value.timeSlotStartTime}`;
      gridMap.set(key, assign);
    }
  }

  return (
    <div
      style={{
        background: "#0F1612",
        borderRadius: "8px",
        border: "1px solid #1C2B22",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header & Division Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={15} color="#39FF88" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#EEF8F1", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            SCHEDULE MATRIX // 6-DAY DISPATCH
          </span>
          <span
            style={{
              fontSize: "10px",
              background: "rgba(57, 255, 136, 0.1)",
              color: "#39FF88",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: 700,
              border: "1px solid rgba(57, 255, 136, 0.3)",
            }}
          >
            {gridMap.size} SESSIONS PLACED
          </span>
        </div>

        {/* Division Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#0A0E0C",
            borderRadius: "6px",
            padding: "2px",
            border: "1px solid #1C2B22",
          }}
        >
          <div style={{ padding: "3px 8px", display: "flex", alignItems: "center", gap: "4px", color: "#7A8D80", fontSize: "10px", fontWeight: 600 }}>
            <Users size={12} />
            <span>DIV:</span>
          </div>
          {divisions.map((div) => {
            const isSelected = selectedDivision === div;
            return (
              <button
                key={div}
                onClick={() => setSelectedDivision(div)}
                style={{
                  background: isSelected ? "#39FF88" : "transparent",
                  color: isSelected ? "#0A0E0C" : "#7A8D80",
                  border: isSelected ? "1px solid #39FF88" : "1px solid transparent",
                  borderRadius: "4px",
                  padding: "3px 10px",
                  fontSize: "11px",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {div}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Matrix */}
      <div
        style={{
          overflowX: "auto",
          borderRadius: "6px",
          border: "1px solid #1C2B22",
          background: "#0A0E0C",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "11px",
          }}
        >
          <thead>
            <tr style={{ background: "#15201A", color: "#7A8D80" }}>
              <th style={{ padding: "8px 10px", width: "110px", borderBottom: "1px solid #1C2B22", fontSize: "10px", fontWeight: 700 }}>
                TIME SLOT
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid #1C2B22",
                    borderLeft: "1px solid #1C2B22",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "10px",
                    color: "#C5D4CA",
                  }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot.startTime} style={{ borderBottom: "1px solid #141E18" }}>
                <td
                  style={{
                    padding: "8px 10px",
                    fontWeight: 600,
                    color: "#7A8D80",
                    background: "#0E1511",
                    fontSize: "10px",
                  }}
                >
                  {slot.label}
                </td>
                {DAYS.map((day) => {
                  const key = `${day}_${slot.startTime}`;
                  const session = gridMap.get(key);
                  const isLab = session?.courseShortCode.endsWith("-L");

                  return (
                    <td
                      key={key}
                      style={{
                        padding: "6px",
                        borderLeft: "1px solid #141E18",
                        verticalAlign: "top",
                        background: session
                          ? isLab
                            ? "rgba(255, 176, 32, 0.08)"
                            : "rgba(57, 255, 136, 0.08)"
                          : "transparent",
                        transition: "background 0.2s ease",
                        minWidth: "110px",
                        height: "52px",
                      }}
                    >
                      {session ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                            animation: "fadeIn 0.15s ease-in-out",
                            borderLeft: `2px solid ${isLab ? "#FFB020" : "#39FF88"}`,
                            paddingLeft: "4px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: isLab ? "#FFB020" : "#39FF88",
                                fontSize: "11px",
                              }}
                            >
                              {session.courseShortCode}
                            </span>
                            <span
                              style={{
                                fontSize: "9px",
                                background: isLab ? "rgba(255, 176, 32, 0.2)" : "rgba(57, 255, 136, 0.2)",
                                color: isLab ? "#FFB020" : "#39FF88",
                                padding: "1px 4px",
                                borderRadius: "2px",
                                fontWeight: 700,
                              }}
                            >
                              {isLab ? "LAB" : "LEC"}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "9px",
                              color: "#7A8D80",
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <User size={9} color="#7A8D80" />
                              {session.value.facultyShortCode}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <Building size={9} color="#7A8D80" />
                              R{session.value.roomNo}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#1C2B22", fontSize: "10px" }}>—</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
