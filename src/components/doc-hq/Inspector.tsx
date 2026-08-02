import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANIMATIONS, ANIMATION_CATEGORIES } from "@/lib/doc-hq-animations";
import { TRANSITIONS } from "@/lib/doc-hq-transitions";
import type { Clip, EasingKind, FitMode, GradePreset, MediaItem } from "@/lib/doc-hq-types";

const EASINGS: { id: EasingKind; name: string }[] = [
  { id: "linear", name: "Linear" },
  { id: "in", name: "Ease in" },
  { id: "out", name: "Ease out" },
  { id: "inOut", name: "Ease in-out" },
  { id: "back", name: "Back" },
  { id: "elastic", name: "Elastic" },
];

const GRADES: { id: GradePreset; name: string }[] = [
  { id: "none", name: "None" },
  { id: "cinematic", name: "Cinematic" },
  { id: "warm", name: "Warm" },
  { id: "cold", name: "Cold" },
  { id: "noir", name: "Noir" },
  { id: "sepia", name: "Sepia" },
  { id: "teal-orange", name: "Teal & orange" },
  { id: "bleach", name: "Bleach bypass" },
];

const FITS: { id: FitMode; name: string }[] = [
  { id: "cover", name: "Cover" },
  { id: "contain", name: "Contain" },
  { id: "fill", name: "Fill" },
];

export function ClipInspector({
  clip,
  media,
  onUpdate,
}: {
  clip: Clip;
  media: MediaItem[];
  onUpdate: (patch: Partial<Clip>) => void;
}) {
  const patchTransform = (p: Partial<Clip["transform"]>) => onUpdate({ transform: { ...clip.transform, ...p } });
  const patchEffects = (p: Partial<Clip["effects"]>) => onUpdate({ effects: { ...clip.effects, ...p } });
  const patchTransIn = (p: Partial<Clip["transitionIn"]>) => onUpdate({ transitionIn: { ...clip.transitionIn, ...p } });
  const patchTransOut = (p: Partial<Clip["transitionOut"]>) => onUpdate({ transitionOut: { ...clip.transitionOut, ...p } });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clip inspector</CardTitle>
        <CardDescription>Position, animation, transitions and effects for the selected clip.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {clip.kind !== "text" && clip.kind !== "graphic" && (
          <div>
            <Label className="text-xs">Media</Label>
            <Select value={clip.mediaId ?? "__none"} onValueChange={(v) => onUpdate({ mediaId: v === "__none" ? null : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {media
                  .filter((m) => m.kind === "image" || m.kind === "video")
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {clip.kind === "text" && (
          <div className="space-y-2 rounded-md border p-2">
            <Input
              value={clip.text?.content ?? ""}
              onChange={(e) => onUpdate({ text: { ...clip.text!, content: e.target.value } })}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Size · {clip.text?.fontSize}px</Label>
                <Slider min={16} max={140} step={1} value={[clip.text?.fontSize ?? 64]} onValueChange={(v) => onUpdate({ text: { ...clip.text!, fontSize: v[0] } })} />
              </div>
              <div>
                <Label className="text-[10px]">Colour</Label>
                <input type="color" value={clip.text?.color ?? "#ffffff"} onChange={(e) => onUpdate({ text: { ...clip.text!, color: e.target.value } })} className="h-8 w-full rounded border" />
              </div>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Duration · {clip.duration.toFixed(1)}s</Label>
          <Slider min={0.3} max={30} step={0.1} value={[clip.duration]} onValueChange={(v) => onUpdate({ duration: v[0] })} />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <div>
            <Label className="text-[10px]">X · {clip.transform.x}%</Label>
            <Slider min={0} max={100} step={1} value={[clip.transform.x]} onValueChange={(v) => patchTransform({ x: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Y · {clip.transform.y}%</Label>
            <Slider min={0} max={100} step={1} value={[clip.transform.y]} onValueChange={(v) => patchTransform({ y: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Scale · {clip.transform.scale.toFixed(2)}x</Label>
            <Slider min={0.2} max={3} step={0.05} value={[clip.transform.scale]} onValueChange={(v) => patchTransform({ scale: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Rotation · {clip.transform.rotation}°</Label>
            <Slider min={-180} max={180} step={1} value={[clip.transform.rotation]} onValueChange={(v) => patchTransform({ rotation: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Opacity · {Math.round(clip.transform.opacity * 100)}%</Label>
            <Slider min={0} max={1} step={0.02} value={[clip.transform.opacity]} onValueChange={(v) => patchTransform({ opacity: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Fit</Label>
            <Select value={clip.transform.fit} onValueChange={(v) => patchTransform({ fit: v as FitMode })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FITS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-3">
          <Label className="text-xs">Animation</Label>
          <Select value={clip.animation} onValueChange={(v) => onUpdate({ animation: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {ANIMATION_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <div className="px-2 pt-2 text-[10px] font-semibold uppercase text-muted-foreground">{cat}</div>
                  {ANIMATIONS.filter((a) => a.category === cat).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <div>
            <Label className="text-xs">Transition in</Label>
            <Select value={clip.transitionIn.kind} onValueChange={(v) => patchTransIn({ kind: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Transition out</Label>
            <Select value={clip.transitionOut.kind} onValueChange={(v) => patchTransOut({ kind: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">In duration · {clip.transitionIn.duration.toFixed(1)}s</Label>
            <Slider min={0.1} max={3} step={0.1} value={[clip.transitionIn.duration]} onValueChange={(v) => patchTransIn({ duration: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Out duration · {clip.transitionOut.duration.toFixed(1)}s</Label>
            <Slider min={0.1} max={3} step={0.1} value={[clip.transitionOut.duration]} onValueChange={(v) => patchTransOut({ duration: v[0] })} />
          </div>
          <div>
            <Label className="text-[10px]">Colour</Label>
            <input type="color" value={clip.transitionIn.color} onChange={(e) => { patchTransIn({ color: e.target.value }); patchTransOut({ color: e.target.value }); }} className="h-8 w-full rounded border" />
          </div>
          <div>
            <Label className="text-[10px]">Easing</Label>
            <Select value={clip.transitionIn.easing} onValueChange={(v) => { patchTransIn({ easing: v as EasingKind }); patchTransOut({ easing: v as EasingKind }); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EASINGS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 border-t pt-3">
          <Label className="text-xs font-semibold">Effects</Label>
          <div>
            <Label className="text-[10px]">Grade</Label>
            <Select value={clip.effects.grade} onValueChange={(v) => patchEffects({ grade: v as GradePreset })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Exposure · {clip.effects.exposure}</Label>
              <Slider min={-40} max={40} step={1} value={[clip.effects.exposure]} onValueChange={(v) => patchEffects({ exposure: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Contrast · {clip.effects.contrast}</Label>
              <Slider min={-40} max={40} step={1} value={[clip.effects.contrast]} onValueChange={(v) => patchEffects({ contrast: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Saturation · {clip.effects.saturation}</Label>
              <Slider min={-60} max={60} step={1} value={[clip.effects.saturation]} onValueChange={(v) => patchEffects({ saturation: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Grain · {Math.round(clip.effects.grain * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[clip.effects.grain]} onValueChange={(v) => patchEffects({ grain: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Vignette · {Math.round(clip.effects.vignette * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[clip.effects.vignette]} onValueChange={(v) => patchEffects({ vignette: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Blur · {clip.effects.blur}px</Label>
              <Slider min={0} max={20} step={0.5} value={[clip.effects.blur]} onValueChange={(v) => patchEffects({ blur: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Glow · {Math.round(clip.effects.glow * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[clip.effects.glow]} onValueChange={(v) => patchEffects({ glow: v[0] })} />
            </div>
            <div>
              <Label className="text-[10px]">Chromatic aberration · {Math.round(clip.effects.chroma * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[clip.effects.chroma]} onValueChange={(v) => patchEffects({ chroma: v[0] })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <Label className="text-xs">Letterbox</Label>
            <Switch checked={clip.effects.letterbox} onCheckedChange={(v) => patchEffects({ letterbox: v })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
