import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { VisualizerNode } from "../hooks/useSolverWorker.js";
import { ZoomIn, ZoomOut, RotateCcw, Activity, Radio } from "lucide-react";

interface VisualizerProps {
  treeData: VisualizerNode;
  activeNodeId?: string;
  playbackState: string;
}

export const AlgorithmVisualizer: React.FC<VisualizerProps> = ({
  treeData,
  activeNodeId,
  playbackState,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const isEmpty = !treeData.children || treeData.children.length === 0;

  // Render & Update D3 Tree Layout
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const height = container.clientHeight || 500;

    const svg = d3.select(svgRef.current);

    let g = svg.select<SVGGElement>("g.tree-container");
    if (g.empty()) {
      g = svg.append("g").attr("class", "tree-container");

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.05, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      zoomBehaviorRef.current = zoom;
      svg.call(zoom);

      // Initial Viewport Centering
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(60, height / 2).scale(0.8)
      );
    }

    if (isEmpty) {
      g.selectAll("*").remove();
      return;
    }

    // Compute D3 Tree Layout
    const hierarchyRoot = d3.hierarchy(treeData);
    const treeLayout = d3.tree<VisualizerNode>().nodeSize([45, 140]);
    treeLayout(hierarchyRoot);

    const descendants = hierarchyRoot.descendants();
    const links = hierarchyRoot.links();

    // Link Horizontal Generator
    const linkGenerator = d3
      .linkHorizontal<any, d3.HierarchyPointNode<VisualizerNode>>()
      .x((d) => d.y)
      .y((d) => d.x);

    // Render Links
    const linkSelection = g.selectAll<SVGPathElement, d3.HierarchyPointLink<VisualizerNode>>("path.link")
      .data(links, (d: any) => d.target.data.id);

    linkSelection.exit().remove();

    linkSelection
      .enter()
      .append("path")
      .attr("class", "link")
      .merge(linkSelection)
      .attr("d", linkGenerator as any)
      .attr("fill", "none")
      .attr("stroke", (d) => {
        if (d.target.data.status === "SUCCESS") return "#39FF88"; // Phosphor Green
        if (d.target.data.status === "CONFLICT") return "#FF3B3B"; // Oscilloscope Red
        if (d.target.data.status === "PRUNED") return "#1E2E25"; // Dim Slate
        return "#39FF88";
      })
      .attr("stroke-width", (d) => (d.target.data.status === "SUCCESS" ? 2 : 1.2))
      .attr("stroke-dasharray", (d) => (d.target.data.status === "PRUNED" ? "3,3" : "none"))
      .attr("opacity", (d) => (d.target.data.status === "PRUNED" ? 0.35 : 0.85));

    // Render Nodes
    const nodeSelection = g.selectAll<SVGGElement, d3.HierarchyPointNode<VisualizerNode>>("g.node")
      .data(descendants, (d: any) => d.data.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        const [mx, my] = d3.pointer(event, container);
        const data = d.data;
        const details = [
          `NODE // ${data.name}`,
          `STATUS: ${data.status}`,
          data.valueSummary ? `ASSIGN: ${data.valueSummary}` : "",
          data.conflictReason ? `VIOLATION: ${data.conflictReason}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        setActiveTooltip({
          x: mx + 15,
          y: my + 15,
          content: details,
        });
      })
      .on("mouseleave", () => setActiveTooltip(null));

    nodeEnter
      .append("circle")
      .attr("r", (d) => (d.data.status === "ROOT" ? 8 : 6));

    nodeEnter
      .append("text")
      .attr("dy", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "#EEF8F1")
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono, monospace");

    const nodeUpdate = nodeEnter.merge(nodeSelection);

    nodeUpdate
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    nodeUpdate
      .select("circle")
      .attr("fill", (d) => {
        if (d.data.status === "ROOT") return "#39FF88";
        if (d.data.status === "SUCCESS") return "#39FF88";
        if (d.data.status === "CONFLICT") return "#FF3B3B";
        if (d.data.status === "PRUNED") return "#121A15";
        return "#39FF88";
      })
      .attr("stroke", (d) => {
        if (d.data.id === activeNodeId) return "#FFFFFF";
        if (d.data.status === "SUCCESS") return "#39FF88";
        if (d.data.status === "CONFLICT") return "#FF8888";
        if (d.data.status === "PRUNED") return "#2A3F33";
        return "#39FF88";
      })
      .attr("stroke-width", (d) => (d.data.id === activeNodeId ? 2.5 : 1))
      .attr("r", (d) => (d.data.id === activeNodeId ? 7.5 : d.data.status === "ROOT" ? 8 : 5.5))
      .style("filter", (d) => {
        if (d.data.id === activeNodeId) return "drop-shadow(0 0 6px #FFFFFF)";
        if (d.data.status === "SUCCESS") return "drop-shadow(0 0 4px #39FF88)";
        if (d.data.status === "CONFLICT") return "drop-shadow(0 0 6px #FF3B3B)";
        return "none";
      });

    nodeUpdate
      .select("text")
      .text((d) => d.data.name)
      .attr("fill", (d) => (d.data.status === "PRUNED" ? "#4B5A50" : "#EEF8F1"))
      .attr("font-weight", (d) => (d.data.status === "SUCCESS" || d.data.id === activeNodeId ? "700" : "400"));

    // Smooth auto-panning during playback
    if (playbackState === "RUNNING" && activeNodeId && zoomBehaviorRef.current) {
      const activeDescendant = descendants.find((d) => d.data.id === activeNodeId);
      if (activeDescendant && (activeDescendant.y ?? 0) > 550) {
        const currentTransform = d3.zoomTransform(svg.node() as any);
        const targetX = 100 - (activeDescendant.y ?? 0) * currentTransform.k;
        const targetY = height / 2 - (activeDescendant.x ?? 0) * currentTransform.k;
        svg.transition().duration(80).call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(targetX, targetY).scale(currentTransform.k)
        );
      }
    }
  }, [treeData, activeNodeId, playbackState, isEmpty]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const height = containerRef.current.clientHeight || 500;
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(60, height / 2).scale(0.8));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "480px",
        background: "#0A0E0C",
        backgroundImage: "radial-gradient(#15221B 1px, transparent 1px), radial-gradient(#15221B 1px, #0A0E0C 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 12px 12px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #1C2B22",
      }}
    >
      {/* Visualizer Scope Header Overlay */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(15, 22, 18, 0.9)",
          backdropFilter: "blur(8px)",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "1px solid #1C2B22",
          zIndex: 10,
        }}
      >
        <Activity size={14} color="#39FF88" />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#EEF8F1", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          OSCILLOSCOPE // CSP SEARCH GRAPH
        </span>
        <span
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "3px",
            background:
              playbackState === "RUNNING"
                ? "rgba(57, 255, 136, 0.15)"
                : playbackState === "COMPLETED"
                ? "rgba(57, 255, 136, 0.25)"
                : "rgba(122, 141, 128, 0.15)",
            color:
              playbackState === "RUNNING"
                ? "#39FF88"
                : playbackState === "COMPLETED"
                ? "#39FF88"
                : "#7A8D80",
            fontWeight: 700,
            border: `1px solid ${playbackState === "RUNNING" ? "rgba(57, 255, 136, 0.4)" : "#1C2B22"}`,
          }}
        >
          {playbackState}
        </span>
      </div>

      {/* Empty State / Radar Sweep Reticle */}
      {isEmpty && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {/* Oscilloscope Reticle Ring */}
          <div
            style={{
              position: "relative",
              width: "140px",
              height: "140px",
              borderRadius: "50%",
              border: "1px dashed #2A3F33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "90px",
                height: "90px",
                borderRadius: "50%",
                border: "1px solid #1C2B22",
              }}
            />
            {/* Rotating Radar Sweep Line */}
            <div
              style={{
                position: "absolute",
                width: "70px",
                height: "2px",
                background: "linear-gradient(90deg, #39FF88, transparent)",
                top: "50%",
                left: "50%",
                transformOrigin: "0 0",
                animation: "radarSweep 3s linear infinite",
              }}
            />
            <Radio size={22} color="#39FF88" style={{ opacity: 0.8 }} />
          </div>

          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#39FF88", fontWeight: 700, letterSpacing: "0.08em" }}>
              // STANDBY // AWAITING SEARCH TRACE
            </span>
            <span style={{ fontSize: "11px", color: "#7A8D80", maxWidth: "340px", lineHeight: "1.4" }}>
              Select a benchmark preset & press "Start CSP Solver" to begin live algorithm tree visualization.
            </span>
          </div>
        </div>
      )}

      {/* Legend & Controls */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "rgba(15, 22, 18, 0.9)",
          backdropFilter: "blur(8px)",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "1px solid #1C2B22",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "10px", color: "#7A8D80", letterSpacing: "0.04em" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#39FF88", boxShadow: "0 0 6px #39FF88" }} />
            ASSIGNED
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF3B3B", boxShadow: "0 0 6px #FF3B3B" }} />
            CONFLICT
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4B5A50" }} />
            PRUNED
          </span>
        </div>

        <div style={{ width: "1px", height: "14px", background: "#1C2B22" }} />

        <button
          onClick={handleZoomIn}
          style={{ background: "none", border: "none", color: "#7A8D80", cursor: "pointer", display: "flex", padding: "2px" }}
          title="Zoom In (+)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          style={{ background: "none", border: "none", color: "#7A8D80", cursor: "pointer", display: "flex", padding: "2px" }}
          title="Zoom Out (-)"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleResetZoom}
          style={{ background: "none", border: "none", color: "#7A8D80", cursor: "pointer", display: "flex", padding: "2px" }}
          title="Reset Viewport"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />

      {/* Tooltip Overlay */}
      {activeTooltip && (
        <div
          style={{
            position: "absolute",
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            background: "#0F1612",
            border: "1px solid #39FF88",
            borderRadius: "4px",
            padding: "8px 12px",
            fontSize: "11px",
            color: "#EEF8F1",
            fontFamily: "JetBrains Mono, monospace",
            whiteSpace: "pre-line",
            pointerEvents: "none",
            boxShadow: "0 0 12px rgba(57, 255, 136, 0.25)",
            zIndex: 100,
            lineHeight: "1.5",
          }}
        >
          {activeTooltip.content}
        </div>
      )}
    </div>
  );
};
