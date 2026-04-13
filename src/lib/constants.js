export const STAGE_COLORS = {
  new: "bg-slate-100 text-slate-600",
  needs_reply: "bg-violet-100 text-violet-700",
  contacted: "bg-blue-100 text-blue-700",
  warm: "bg-amber-100 text-amber-700",
  hot: "bg-red-100 text-red-700",
  lost: "bg-gray-100 text-gray-500",
  closed: "bg-emerald-100 text-emerald-700",
  unsubscribed: "bg-gray-100 text-gray-400",
};

export const STAGE_LIST = [
  "new", "needs_reply", "contacted", "warm", "hot", "lost", "closed", "unsubscribed",
];

export const STAGE_LABELS = {
  new: "New",
  needs_reply: "Needs Reply",
  contacted: "Contacted",
  warm: "Warm",
  hot: "Hot",
  lost: "Lost",
  closed: "Closed",
  unsubscribed: "Unsubscribed",
};

export const INTENT_COLORS = {
  cold: "text-slate-400",
  warm: "text-amber-600",
  hot: "text-red-600",
};

export const INTENT_DOT = {
  cold: "bg-slate-300",
  warm: "bg-amber-400",
  hot: "bg-red-500",
};
