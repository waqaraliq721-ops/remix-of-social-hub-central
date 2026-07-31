import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";

/** Any studio palette shape: two-stop background plus element colours. */
export type PaletteLike = {
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
  muted: string;
};

export type ColorKey = "bg0" | "bg1" | "primary" | "accent" | "text" | "muted";
export type ColorOverrides = Partial<Record<ColorKey, string>>;

export const NO_OVERRIDES: ColorOverrides = {};

/** Returns a copy of `p` with any user overrides applied. */
export function applyOverrides<T extends PaletteLike>(p: T, o: ColorOverrides | undefined): T {
  if (!o || Object.keys(o).length === 0) return p;
  return {
    ...p,
    bg: [o.bg0 ?? p.bg[0], o.bg1 ?? p.bg[1]] as [string, string],
    primary: o.primary ?? p.primary,
    accent: o.accent ?? p.accent,
    text: o.text ?? p.text,
    muted: o.muted ?? p.muted,
  };
}

const FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: "bg0", label: "Background", hint: "Base of the gradient" },
  { key: "bg1", label: "Background 2", hint: "Second gradient stop" },
  { key: "primary", label: "Primary", hint: "Discs, bars, highlights" },
  { key: "accent", label: "Accent", hint: "Active line, glow" },
  { key: "text", label: "Text", hint: "Main type colour" },
  { key: "muted", label: "Muted", hint: "Secondary type" },
];

function valueOf(base: PaletteLike, o: ColorOverrides, key: ColorKey) {
  switch (key) {
    case "bg0":
      return o.bg0 ?? base.bg[0];
    case "bg1":
      return o.bg1 ?? base.bg[1];
    default:
      return o[key] ?? base[key];
  }
}

export function ColorCustomiser({
  base,
  value,
  onChange,
  title = "Colours",
  description = "Override the template palette — background and every element.",
}: {
  base: PaletteLike;
  value: ColorOverrides;
  onChange: (next: ColorOverrides) => void;
  title?: string;
  description?: string;
}) {
  const set = (key: ColorKey, hex: string) => onChange({ ...value, [key]: hex });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          disabled={Object.keys(value).length === 0}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={f.label}
                value={valueOf(base, value, f.key)}
                onChange={(e) => set(f.key, e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {valueOf(base, value, f.key)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
