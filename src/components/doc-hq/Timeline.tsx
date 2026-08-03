import { useCallback, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Volume2, VolumeX, Lock, Unlock, Eye, EyeOff, Copy, ZoomIn, ZoomOut, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtTime, type Clip, type MediaItem, type Track } from "@/lib/doc-hq-types";

const TRACK_H = 56;
const SNAP_PX = 8;

type TimelineProps = {
  tracks: Track[];
  media: MediaItem[];
  selectedClipId: string | null;
  selectedTrackId: string | null;
  currentTime: number;
  totalDuration: number;
  onSeek: (t: number) => void;
  onSelectClip: (id: string | null) => void;
  onSelectTrack: (id: string | null) => void;
  onUpdateClip: (id: string, patch: Partial<Clip>) => void;
  onDuplicateClip: (id: string) => void;
  onDeleteClip: (id: string) => void;
  onAddClip: (trackId: string) => void;
  onAddTrack: (kind: "visual" | "audio") => void;
  onDeleteTrack: (id: string) => void;
  onUpdateTrack: (id: string, patch: Partial<Track>) => void;
  onReorderTrack: (id: string, dir: -1 | 1) => void;
};

export function Timeline({
  tracks,
  media,
  selectedClipId,
  selectedTrackId,
  currentTime,
  totalDuration,
  onSeek,
  onSelectClip,
  onSelectTrack,
  onUpdateClip,
  onDuplicateClip,
  onDeleteClip,
  onAddClip,
  onAddTrack,
  onDeleteTrack,
  onUpdateTrack,
  onReorderTrack,
}: TimelineProps) {
  const [pxPerSec, setPxPerSec] = useState(80);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allEdges = useMemo(() => {
    const edges: number[] = [0];
    for (const tr of tracks) for (const c of tr.clips) edges.push(c.start, c.start + c.duration);
    return edges;
  }, [tracks]);

  const snap = useCallback(
    (val: number, exclude: [number, number]) => {
      let best = val;
      let bestDist = SNAP_PX / pxPerSec;
      for (const e of allEdges) {
        if (Math.abs(e - exclude[0]) < 1e-6 || Math.abs(e - exclude[1]) < 1e-6) continue;
        const d = Math.abs(e - val);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      const d2 = Math.abs(currentTime - val);
      if (d2 < bestDist) best = currentTime;
      return best;
    },
    [allEdges, pxPerSec, currentTime],
  );

  const dragState = useRef<{
    id: string;
    mode: "move" | "left" | "right";
    startX: number;
    origStart: number;
    origDur: number;
    trackId: string;
    kind: Clip["kind"];
  } | null>(null);

  const isTrackCompatible = (clipKind: Clip["kind"], trackKind: Track["kind"]) =>
    clipKind === "audio" ? trackKind === "audio" : trackKind === "visual";

  const beginDrag = (e: React.PointerEvent, clip: Clip, mode: "move" | "left" | "right") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { id: clip.id, mode, startX: e.clientX, origStart: clip.start, origDur: clip.duration, trackId: clip.trackId, kind: clip.kind };
    onSelectClip(clip.id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    const deltaT = (e.clientX - d.startX) / pxPerSec;
    if (d.mode === "move") {
      let next = Math.max(0, d.origStart + deltaT);
      next = snap(next, [d.origStart, d.origStart + d.origDur]);
      const patch: Partial<Clip> = { start: next };
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const laneEl = el?.closest("[data-track-id]") as HTMLElement | null;
      const targetTrackId = laneEl?.dataset.trackId;
      if (targetTrackId && targetTrackId !== d.trackId) {
        const targetTrack = tracks.find((t) => t.id === targetTrackId);
        if (targetTrack && !targetTrack.locked && isTrackCompatible(d.kind, targetTrack.kind)) {
          patch.trackId = targetTrackId;
          d.trackId = targetTrackId;
        }
      }
      onUpdateClip(d.id, patch);
    } else if (d.mode === "left") {
      let next = Math.max(0, d.origStart + deltaT);
      next = snap(next, [d.origStart, d.origStart + d.origDur]);
      const newDur = d.origStart + d.origDur - next;
      if (newDur > 0.2) onUpdateClip(d.id, { start: next, duration: newDur });
    } else {
      let end = d.origStart + d.origDur + deltaT;
      end = snap(end, [d.origStart, d.origStart + d.origDur]);
      const newDur = Math.max(0.2, end - d.origStart);
      onUpdateClip(d.id, { duration: newDur });
    }
  };

  const endDrag = () => {
    dragState.current = null;
  };

  const rulerMarks = useMemo(() => {
    const step = pxPerSec < 40 ? 5 : pxPerSec < 90 ? 2 : 1;
    const marks: number[] = [];
    for (let t = 0; t <= totalDuration + step; t += step) marks.push(t);
    return marks;
  }, [pxPerSec, totalDuration]);

  const contentW = Math.max(600, (totalDuration + 5) * pxPerSec);

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => onAddTrack("visual")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Visual track
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddTrack("audio")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Audio track
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setPxPerSec((v) => Math.max(20, v - 20))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setPxPerSec((v) => Math.min(300, v + 20))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[42vh] overflow-auto" onPointerMove={onPointerMove} onPointerUp={endDrag}>
        <div style={{ width: contentW + 160 }}>
          {/* ruler */}
          <div className="sticky top-0 z-10 flex border-b bg-background">
            <div className="w-40 shrink-0 border-r" />
            <div
              className="relative h-7 flex-1 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(Math.max(0, (e.clientX - rect.left) / pxPerSec));
              }}
            >
              {rulerMarks.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l text-[10px] text-muted-foreground" style={{ left: t * pxPerSec }}>
                  <span className="ml-1">{fmtTime(t).slice(0, 5)}</span>
                </div>
              ))}
              <div className="absolute top-0 z-20 h-full w-px bg-primary" style={{ left: currentTime * pxPerSec }}>
                <div className="absolute -left-1.5 -top-1 h-2.5 w-3.5 rounded-sm bg-primary" />
              </div>
            </div>
          </div>

          {tracks.map((track, ti) => (
            <div key={track.id} className={`flex border-b ${track.id === selectedTrackId ? "bg-primary/5" : ""}`}>
              <div
                className={`flex w-40 shrink-0 cursor-pointer flex-col justify-center gap-1 border-r p-2 text-xs ${track.id === selectedTrackId ? "ring-1 ring-inset ring-primary/50" : ""}`}
                onClick={() => onSelectTrack(track.id === selectedTrackId ? null : track.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">{track.name}</span>
                  <div className="flex gap-0.5">
                    <button onClick={() => onReorderTrack(track.id, -1)} disabled={ti === 0} className="disabled:opacity-30">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => onReorderTrack(track.id, 1)} disabled={ti === tracks.length - 1} className="disabled:opacity-30">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <button onClick={() => onUpdateTrack(track.id, { muted: !track.muted })} title="Mute">
                    {track.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => onUpdateTrack(track.id, { locked: !track.locked })} title="Lock">
                    {track.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => onUpdateTrack(track.id, { hidden: !track.hidden })} title="Visibility">
                    {track.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => onAddClip(track.id)} title="Add clip" className="ml-auto">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDeleteTrack(track.id)} title="Delete track" className="hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div
                className="relative flex-1"
                data-track-id={track.id}
                style={{ height: TRACK_H }}
                onClick={() => onSelectClip(null)}
              >
                {track.clips.map((clip) => {
                  const m = clip.mediaId ? media.find((mm) => mm.id === clip.mediaId) : null;
                  const active = clip.id === selectedClipId;
                  return (
                    <div
                      key={clip.id}
                      onPointerDown={(e) => beginDrag(e, clip, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(clip.id);
                      }}
                      className={`group absolute top-1 flex h-[calc(100%-8px)] cursor-grab items-center overflow-hidden rounded-md border text-[11px] text-white ${
                        active ? "border-primary ring-2 ring-primary/40" : "border-black/20"
                      }`}
                      style={{
                        left: clip.start * pxPerSec,
                        width: Math.max(10, clip.duration * pxPerSec),
                        background:
                          clip.kind === "text"
                            ? "#7c3aed"
                            : clip.kind === "graphic"
                              ? "#0891b2"
                              : clip.kind === "audio"
                                ? "#16a34a"
                                : "#334155",
                      }}
                    >
                      <div
                        onPointerDown={(e) => beginDrag(e, clip, "left")}
                        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-black/20 opacity-0 group-hover:opacity-100"
                      />
                      <span className="truncate px-2">{clip.text?.content || m?.name || clip.kind}</span>
                      <div className="ml-auto flex shrink-0 gap-1 pr-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateClip(clip.id);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClip(clip.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div
                        onPointerDown={(e) => beginDrag(e, clip, "right")}
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/20 opacity-0 group-hover:opacity-100"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
