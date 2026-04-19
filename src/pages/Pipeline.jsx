import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useProfile } from "../lib/ProfileContext";
import { isManagerAdminOrOwner } from "../lib/roles";
import { supabase } from "../lib/supabase";

const STAGES = [
  { key: "new", label: "New", accent: "#94a3b8" },
  { key: "contacted", label: "Contacted", accent: "#2563eb" },
  { key: "warm", label: "Warm", accent: "#f59e0b" },
  { key: "hot", label: "Hot", accent: "#ef4444" },
  { key: "closed", label: "Closed", accent: "#22c55e" },
  { key: "unsubscribed", label: "Unsubscribed", accent: "#64748b" },
];

const INTENT_DOT = {
  cold: "#cbd5e1",
  warm: "#f59e0b",
  hot: "#ef4444",
};

function getLeadName(lead) {
  return `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "Unnamed lead";
}

function getStageLabel(stageKey) {
  return STAGES.find((stage) => stage.key === stageKey)?.label || stageKey;
}

function buildStageBuckets(leads) {
  return STAGES.reduce((buckets, stage) => {
    buckets[stage.key] = leads.filter((lead) => lead.stage === stage.key);
    return buckets;
  }, {});
}

function getTransformStyle(transform) {
  if (!transform) return undefined;

  const scaleX = typeof transform.scaleX === "number" ? transform.scaleX : 1;
  const scaleY = typeof transform.scaleY === "number" ? transform.scaleY : 1;

  return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function getLeadIndex(leads, leadId) {
  return leads.findIndex((lead) => lead.id === leadId);
}

function resolveDropStage(overId, leads) {
  if (!overId) return null;

  if (STAGES.some((stage) => stage.key === overId)) {
    return overId;
  }

  return leads.find((lead) => lead.id === overId)?.stage || null;
}

function moveLeadInList(leads, activeId, overId, targetStage) {
  const activeIndex = getLeadIndex(leads, activeId);

  if (activeIndex === -1 || !targetStage) {
    return leads;
  }

  const nextLeads = leads.map((lead) =>
    lead.id === activeId ? { ...lead, stage: targetStage } : lead
  );

  const updatedActiveIndex = getLeadIndex(nextLeads, activeId);

  if (updatedActiveIndex === -1) {
    return leads;
  }

  if (!overId || overId === targetStage) {
    const firstTargetIndex = nextLeads.findIndex((lead) => lead.stage === targetStage && lead.id !== activeId);
    if (firstTargetIndex === -1) {
      return nextLeads;
    }

    return arrayMove(nextLeads, updatedActiveIndex, firstTargetIndex);
  }

  const overIndex = getLeadIndex(nextLeads, overId);

  if (overIndex === -1 || overIndex === updatedActiveIndex) {
    return nextLeads;
  }

  return arrayMove(nextLeads, updatedActiveIndex, overIndex);
}

function LoadingBoard() {
  return (
    <div className="p-6">
      <div className="h-7 w-28 rounded bg-slate-200 animate-pulse mb-2" />
      <div className="h-4 w-48 rounded bg-slate-200 animate-pulse mb-6" />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className="shrink-0 w-[280px]">
            <div className="h-[520px] rounded-2xl border border-slate-200 bg-white/70 p-4">
              <div className="h-5 w-24 rounded bg-slate-200 animate-pulse mb-4" />
              <div className="space-y-3">
                {[0, 1, 2].map((card) => (
                  <div key={card} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-6">
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>
          Pipeline
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#64748b" }}>
          Pipeline management is limited to managers, admins, and owners.
        </p>
      </div>
    </div>
  );
}

function StageColumn({ stage, leads, activeId, children }) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.key,
    data: {
      type: "stage",
      stage: stage.key,
    },
  });

  return (
    <div className="shrink-0 w-[280px]">
      <div
        className={`rounded-2xl border p-4 transition-colors ${isOver ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white"}`}
        style={{ minHeight: "560px" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.accent }} />
            <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>
              {stage.label}
            </span>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: "#e2e8f0", color: "#475569" }}
          >
            {leads.length}
          </span>
        </div>
        <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="space-y-3 min-h-[470px]">
            {children}
            {!leads.length && (
              <div className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm ${activeId ? "border-blue-200 text-blue-600" : "border-slate-200 text-slate-400"}`}>
                Drop a lead here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function LeadCard({ lead, onOpen, dragging = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "lead",
      stage: lead.stage,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: getTransformStyle(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className={dragging ? "rotate-1" : ""}
    >
      <LeadCardBody
        lead={lead}
        onOpen={onOpen}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={dragging || isDragging}
      />
    </div>
  );
}

function LeadCardBody({ lead, onOpen, dragHandleProps, isDragging = false }) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-sm transition-shadow ${isDragging ? "border-blue-300 shadow-lg" : "border-slate-200 hover:shadow-md"}`}
      style={{ backgroundColor: "#ffffff" }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={onOpen}
            className="truncate text-left text-sm font-semibold hover:underline"
            style={{ color: "#0f172a" }}
          >
            {getLeadName(lead)}
          </button>
          {lead.phone && (
            <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
              {lead.phone}
            </p>
          )}
        </div>
        {lead.intent_score && (
          <span
            title={`Intent: ${lead.intent_score}`}
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: INTENT_DOT[lead.intent_score] || "#cbd5e1" }}
          />
        )}
      </div>

      {lead.vehicle_interest && (
        <p className="mb-3 text-xs" style={{ color: "#64748b" }}>
          {lead.vehicle_interest}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide"
          style={{ backgroundColor: "#f1f5f9", color: "#475569" }}
        >
          {getStageLabel(lead.stage)}
        </span>
        <button
          type="button"
          aria-label={`Drag ${getLeadName(lead)}`}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          {...dragHandleProps}
        >
          Drag
        </button>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { profile, profileLoading } = useProfile();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [savingLeadId, setSavingLeadId] = useState(null);

  const canManagePipeline = isManagerAdminOrOwner(profile?.role);
  const stageBuckets = useMemo(() => buildStageBuckets(leads), [leads]);
  const activeLead = activeLeadId ? leads.find((lead) => lead.id === activeLeadId) || null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchLeads() {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone, vehicle_interest, stage, intent_score, created_at")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || "Could not load pipeline.");
        setLeads([]);
      } else {
        setLeads(data || []);
      }

      setLoading(false);
    }

    fetchLeads();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persistStageChange(leadId, nextStage, previousLeads) {
    setSavingLeadId(leadId);
    setError("");

    const { error: updateError } = await supabase
      .from("leads")
      .update({ stage: nextStage })
      .eq("id", leadId);

    if (updateError) {
      setLeads(previousLeads);
      setError(updateError.message || "Could not update lead stage.");
    }

    setSavingLeadId(null);
  }

  function handleDragStart(event) {
    setActiveLeadId(event.active.id);
  }

  function handleDragCancel() {
    setActiveLeadId(null);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveLeadId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const currentLead = leads.find((lead) => lead.id === active.id);
    const targetStage = resolveDropStage(over.id, leads);

    if (!currentLead || !targetStage) {
      return;
    }

    const previousLeads = leads;
    const nextLeads = moveLeadInList(leads, active.id, over.id, targetStage);
    setLeads(nextLeads);

    if (currentLead.stage !== targetStage) {
      await persistStageChange(active.id, targetStage, previousLeads);
    }
  }

  if (profileLoading || loading) {
    return <LoadingBoard />;
  }

  if (!canManagePipeline) {
    return <AccessDenied />;
  }

  return (
    <div className="p-6" style={{ backgroundColor: "#f1f5f9" }}>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>
            Pipeline
          </h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Drag leads between stages to keep the desk current.
          </p>
        </div>
        <div className="text-sm font-medium" style={{ color: "#64748b" }}>
          {leads.length} total lead{leads.length !== 1 ? "s" : ""}
          {savingLeadId ? " | Saving move..." : ""}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              leads={stageBuckets[stage.key] || []}
              activeId={activeLeadId}
            >
              {(stageBuckets[stage.key] || []).map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => navigate(`/leads/${lead.id}`)}
                />
              ))}
            </StageColumn>
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="w-[260px]">
              <LeadCardBody lead={activeLead} onOpen={() => {}} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
