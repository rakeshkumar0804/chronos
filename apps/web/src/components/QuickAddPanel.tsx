import React, { useState } from "react";
import { Plus, UserPlus, DoorOpen, BookOpen, RotateCcw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface FacultyItem {
  id: string;
  shortCode: string;
  fullName: string;
  email: string;
}

interface RoomItem {
  id: string;
  roomNo: string;
  type: string;
}

interface CourseItem {
  id: string;
  code: string;
  name: string;
  shortCode: string;
  type: string;
  weeklyHours: number;
}

interface QuickAddPanelProps {
  facultyList: FacultyItem[];
  roomList?: RoomItem[];
  courseList?: CourseItem[];
  onDataRefreshed: () => void;
  disabled?: boolean;
}

export const QuickAddPanel: React.FC<QuickAddPanelProps> = ({
  facultyList,
  onDataRefreshed,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"FACULTY" | "ROOM" | "COURSE">("COURSE");

  // Form states
  const [facultyForm, setFacultyForm] = useState({ shortCode: "", fullName: "", email: "" });
  const [roomForm, setRoomForm] = useState({ roomNo: "", type: "LECTURE_ROOM", capacity: 60 });
  const [courseForm, setCourseForm] = useState({
    code: "",
    name: "",
    shortCode: "",
    type: "LECTURE",
    weeklyHours: 3,
    facultyShortCodes: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "SUCCESS" | "ERROR"; text: string } | null>(null);

  // Running log of custom entities created
  const [customEntities, setCustomEntities] = useState<Array<{ type: string; label: string }>>([]);

  const API_BASE = import.meta.env.VITE_API_URL || "";

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyForm.shortCode || !facultyForm.fullName || !facultyForm.email) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/faculty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facultyForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to add faculty");

      setCustomEntities((prev) => [...prev, { type: "FACULTY", label: `${data.faculty.fullName} (${data.faculty.shortCode})` }]);
      setStatusMessage({ type: "SUCCESS", text: `Faculty "${data.faculty.fullName}" created.` });
      setFacultyForm({ shortCode: "", fullName: "", email: "" });
      onDataRefreshed();
    } catch (err: any) {
      setStatusMessage({ type: "ERROR", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.roomNo) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roomForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to add room");

      setCustomEntities((prev) => [...prev, { type: "ROOM", label: `Room ${data.room.roomNo} (${data.room.type})` }]);
      setStatusMessage({ type: "SUCCESS", text: `Room "${data.room.roomNo}" created.` });
      setRoomForm({ roomNo: "", type: "LECTURE_ROOM", capacity: 60 });
      onDataRefreshed();
    } catch (err: any) {
      setStatusMessage({ type: "ERROR", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.code || !courseForm.name || !courseForm.shortCode) return;
    if (courseForm.facultyShortCodes.length === 0) {
      setStatusMessage({ type: "ERROR", text: "Please select at least 1 qualified faculty member." });
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/course`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to add course");

      setCustomEntities((prev) => [
        ...prev,
        {
          type: "COURSE",
          label: `${data.course.shortCode} (${data.course.weeklyHours}h, ${courseForm.facultyShortCodes.join("/")})`,
        },
      ]);
      setStatusMessage({ type: "SUCCESS", text: `Course "${data.course.name} (${data.course.shortCode})" created.` });
      setCourseForm({
        code: "",
        name: "",
        shortCode: "",
        type: "LECTURE",
        weeklyHours: 3,
        facultyShortCodes: [],
      });
      onDataRefreshed();
    } catch (err: any) {
      setStatusMessage({ type: "ERROR", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCustom = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-custom`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to reset custom data");

      setCustomEntities([]);
      setStatusMessage({
        type: "SUCCESS",
        text: `Reset complete. Deleted ${data.deleted.courses} courses, ${data.deleted.faculty} faculty, ${data.deleted.rooms} rooms. Verified benchmark intact.`,
      });
      onDataRefreshed();
    } catch (err: any) {
      setStatusMessage({ type: "ERROR", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFacultySelection = (code: string) => {
    setCourseForm((prev) => ({
      ...prev,
      facultyShortCodes: prev.facultyShortCodes.includes(code)
        ? prev.facultyShortCodes.filter((c) => c !== code)
        : [...prev.facultyShortCodes, code],
    }));
  };

  return (
    <div
      style={{
        background: "#0F1612",
        border: "1px solid #1C2B22",
        borderRadius: "8px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#EEF8F1",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={14} color="#39FF88" />
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            QUICK ADD // LIVE ENTITY INJECTOR
          </span>
          {customEntities.length > 0 && (
            <span
              style={{
                fontSize: "9px",
                background: "#39FF88",
                color: "#0A0E0C",
                padding: "1px 6px",
                borderRadius: "3px",
                fontWeight: 800,
              }}
            >
              +{customEntities.length} CUSTOM
            </span>
          )}
        </div>
        <div style={{ color: "#7A8D80" }}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div
          style={{
            padding: "0 16px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderTop: "1px solid #1C2B22",
            paddingTop: "12px",
          }}
        >
          {/* Subtabs: Faculty | Room | Course */}
          <div
            style={{
              display: "flex",
              background: "#0A0E0C",
              borderRadius: "6px",
              padding: "2px",
              border: "1px solid #1C2B22",
            }}
          >
            <button
              onClick={() => setActiveTab("COURSE")}
              style={{
                flex: 1,
                background: activeTab === "COURSE" ? "#15201A" : "transparent",
                color: activeTab === "COURSE" ? "#39FF88" : "#7A8D80",
                border: activeTab === "COURSE" ? "1px solid #39FF88" : "1px solid transparent",
                borderRadius: "4px",
                padding: "5px 8px",
                fontSize: "10px",
                fontWeight: activeTab === "COURSE" ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <BookOpen size={11} />
              <span>+ COURSE</span>
            </button>

            <button
              onClick={() => setActiveTab("FACULTY")}
              style={{
                flex: 1,
                background: activeTab === "FACULTY" ? "#15201A" : "transparent",
                color: activeTab === "FACULTY" ? "#39FF88" : "#7A8D80",
                border: activeTab === "FACULTY" ? "1px solid #39FF88" : "1px solid transparent",
                borderRadius: "4px",
                padding: "5px 8px",
                fontSize: "10px",
                fontWeight: activeTab === "FACULTY" ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <UserPlus size={11} />
              <span>+ FACULTY</span>
            </button>

            <button
              onClick={() => setActiveTab("ROOM")}
              style={{
                flex: 1,
                background: activeTab === "ROOM" ? "#15201A" : "transparent",
                color: activeTab === "ROOM" ? "#39FF88" : "#7A8D80",
                border: activeTab === "ROOM" ? "1px solid #39FF88" : "1px solid transparent",
                borderRadius: "4px",
                padding: "5px 8px",
                fontSize: "10px",
                fontWeight: activeTab === "ROOM" ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <DoorOpen size={11} />
              <span>+ ROOM</span>
            </button>
          </div>

          {/* Form: Add Course */}
          {activeTab === "COURSE" && (
            <form onSubmit={handleAddCourse} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <input
                  type="text"
                  placeholder="Code (e.g. CS999)"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                  style={inputStyle}
                  required
                />
                <input
                  type="text"
                  placeholder="Short (e.g. QC)"
                  value={courseForm.shortCode}
                  onChange={(e) => setCourseForm({ ...courseForm, shortCode: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>

              <input
                type="text"
                placeholder="Full Course Name (e.g. Quantum Computing)"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                style={inputStyle}
                required
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <select
                  value={courseForm.type}
                  onChange={(e) => setCourseForm({ ...courseForm, type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="LECTURE">LECTURE (Classroom)</option>
                  <option value="LAB">LAB (Laboratory)</option>
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#0A0E0C", padding: "0 8px", borderRadius: "4px", border: "1px solid #1C2B22" }}>
                  <span style={{ fontSize: "10px", color: "#7A8D80" }}>Hours/wk:</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={courseForm.weeklyHours}
                    onChange={(e) => setCourseForm({ ...courseForm, weeklyHours: Number(e.target.value) })}
                    style={{ ...inputStyle, border: "none", width: "45px", padding: "4px 0" }}
                  />
                </div>
              </div>

              {/* Faculty Selector Multi-select Chips */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "9px", color: "#7A8D80", fontWeight: 600 }}>ASSIGN QUALIFIED FACULTY (CLICK TO SELECT):</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "70px", overflowY: "auto", padding: "2px" }}>
                  {facultyList.map((f) => {
                    const isSelected = courseForm.facultyShortCodes.includes(f.shortCode);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => toggleFacultySelection(f.shortCode)}
                        style={{
                          background: isSelected ? "rgba(57, 255, 136, 0.15)" : "#0A0E0C",
                          color: isSelected ? "#39FF88" : "#7A8D80",
                          border: `1px solid ${isSelected ? "#39FF88" : "#1C2B22"}`,
                          borderRadius: "3px",
                          padding: "2px 6px",
                          fontSize: "9px",
                          fontWeight: isSelected ? 700 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {f.shortCode} {isSelected && "✓"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={isSubmitting || disabled} style={submitButtonStyle}>
                <Plus size={13} />
                <span>INJECT COURSE INTO SYSTEM</span>
              </button>
            </form>
          )}

          {/* Form: Add Faculty */}
          {activeTab === "FACULTY" && (
            <form onSubmit={handleAddFaculty} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "6px" }}>
                <input
                  type="text"
                  placeholder="Code (e.g. TP)"
                  value={facultyForm.shortCode}
                  onChange={(e) => setFacultyForm({ ...facultyForm, shortCode: e.target.value })}
                  style={inputStyle}
                  required
                />
                <input
                  type="text"
                  placeholder="Full Name (e.g. Dr. Test Person)"
                  value={facultyForm.fullName}
                  onChange={(e) => setFacultyForm({ ...facultyForm, fullName: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <input
                type="email"
                placeholder="Email (e.g. testperson@xyz.edu)"
                value={facultyForm.email}
                onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                style={inputStyle}
                required
              />
              <button type="submit" disabled={isSubmitting || disabled} style={submitButtonStyle}>
                <Plus size={13} />
                <span>INJECT FACULTY</span>
              </button>
            </form>
          )}

          {/* Form: Add Room */}
          {activeTab === "ROOM" && (
            <form onSubmit={handleAddRoom} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <input
                  type="text"
                  placeholder="Room No (e.g. R999)"
                  value={roomForm.roomNo}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNo: e.target.value })}
                  style={inputStyle}
                  required
                />
                <select
                  value={roomForm.type}
                  onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="LECTURE_ROOM">LECTURE ROOM</option>
                  <option value="LAB">LABORATORY</option>
                </select>
              </div>
              <button type="submit" disabled={isSubmitting || disabled} style={submitButtonStyle}>
                <Plus size={13} />
                <span>INJECT ROOM</span>
              </button>
            </form>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                fontSize: "10px",
                padding: "6px 10px",
                borderRadius: "4px",
                background: statusMessage.type === "SUCCESS" ? "rgba(57, 255, 136, 0.1)" : "rgba(255, 59, 59, 0.1)",
                color: statusMessage.type === "SUCCESS" ? "#39FF88" : "#FF3B3B",
                border: `1px solid ${statusMessage.type === "SUCCESS" ? "rgba(57, 255, 136, 0.3)" : "rgba(255, 59, 59, 0.3)"}`,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {statusMessage.type === "SUCCESS" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Running List of Custom Entities */}
          {customEntities.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px dashed #1C2B22", paddingTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "9px", color: "#7A8D80", fontWeight: 700 }}>CUSTOM ENTITIES INJECTED ({customEntities.length}):</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {customEntities.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "9px",
                      background: "#15201A",
                      color: "#39FF88",
                      border: "1px solid rgba(57, 255, 136, 0.3)",
                      borderRadius: "3px",
                      padding: "2px 6px",
                    }}
                  >
                    [{item.type}] {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reset to Benchmark Safety Net Button */}
          <button
            type="button"
            onClick={handleResetCustom}
            disabled={isSubmitting || disabled}
            style={{
              background: "#0A0E0C",
              border: "1px dashed rgba(255, 59, 59, 0.4)",
              borderRadius: "4px",
              padding: "7px 10px",
              color: "#FF3B3B",
              fontSize: "10px",
              fontWeight: 700,
              cursor: isSubmitting || disabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
            title="Purges all custom added items and restores original seeded dataset"
          >
            <RotateCcw size={12} />
            <span>RESET TO BENCHMARK DATA (PURGE CUSTOM)</span>
          </button>
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  background: "#0A0E0C",
  border: "1px solid #1C2B22",
  borderRadius: "4px",
  padding: "6px 8px",
  color: "#EEF8F1",
  fontSize: "10px",
  fontFamily: "JetBrains Mono, monospace",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const submitButtonStyle: React.CSSProperties = {
  background: "#39FF88",
  color: "#0A0E0C",
  border: "1px solid #39FF88",
  borderRadius: "4px",
  padding: "7px 12px",
  fontSize: "10px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  boxShadow: "0 0 10px rgba(57, 255, 136, 0.25)",
};
