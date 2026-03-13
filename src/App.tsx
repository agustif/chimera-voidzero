import { useEffect, useMemo, useState } from "react"
import { useRef } from "react"
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  BookmarkPlus,
  Crosshair,
  FolderOpen,
  ImagePlus,
  Pin,
  RefreshCw,
  Sparkles,
} from "lucide-react"

import {
  assignTarget,
  loadInitialState,
  randomizeActiveSet,
  removeSavedBlendState,
  rerollOneTarget,
  reshuffleActiveSet,
  runSync,
  saveBlendState,
} from "@/domain/app-controller"
import { blendTheme } from "@/domain/interpolation"
import { themeLibrary, themeLibraryMap } from "@/domain/themeLibrary"
import type { AppState, SavedBlendState } from "@/domain/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const libraryIds = themeLibrary.map((target) => target.id)

type SourceCategory = "all" | "ui" | "editorial" | "mixed"

function fallbackState(): AppState {
  return {
    seed: "fallback",
    activeIds: libraryIds.slice(0, 6),
    pinnedIds: [],
    point: { x: 0.52, y: 0.44 },
    controls: {
      contrastGuard: true,
      blendSharpness: 1.45,
      snapStrength: 0.15,
      activeCount: 6,
    },
    selectedTargetId: libraryIds[0] ?? null,
    savedStates: [],
    status: "Recovered from initialization failure. Ready for live debugging.",
  }
}

function createSavedState(
  state: AppState,
  derivedTokens: SavedBlendState["derived"]
): SavedBlendState {
  const timestamp = new Date()
  return {
    id: `${timestamp.getTime()}`,
    label: `System ${timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    seed: state.seed,
    activeIds: state.activeIds,
    point: state.point,
    savedAt: timestamp.toISOString(),
    derived: derivedTokens,
  }
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function fontStack(mode: string) {
  if (mode === "serif")
    return '"Iowan Old Style", "Palatino Linotype", Georgia, serif'
  if (mode === "mono")
    return '"JetBrains Mono Variable", "JetBrains Mono", monospace'
  return '"IBM Plex Sans", "Avenir Next", "Helvetica Neue", sans-serif'
}

function formatCase(copy: string, heroCase: string) {
  if (heroCase === "upper") return copy.toUpperCase()
  if (heroCase === "title")
    return copy.replace(/\b\w/g, (char) => char.toUpperCase())
  return copy
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function buildThemeCss(
  seed: string,
  sourceName: string | undefined,
  derived: ReturnType<typeof blendTheme>
) {
  const t = derived.tokens
  return `/* Chimera VoidZero preset
   seed: ${seed}
   source: ${sourceName ?? "unknown"}
*/

:root {
  --background: ${t.background};
  --foreground: ${t.text};
  --card: ${t.surface};
  --card-foreground: ${t.text};
  --popover: ${t.surface};
  --popover-foreground: ${t.text};
  --primary: ${t.accent};
  --primary-foreground: ${t.background};
  --secondary: ${t.surface2};
  --secondary-foreground: ${t.text};
  --muted: ${t.surface2};
  --muted-foreground: ${t.muted};
  --accent: ${t.accent2};
  --accent-foreground: ${t.text};
  --border: ${t.border};
  --input: ${t.border};
  --ring: ${t.accent};
  --radius: ${Math.round(t.radius)}px;
}

@theme inline {
  --font-sans: ${fontStack(derived.discrete.fontFamily)};
}`
}

function buildComponentSnippet(
  sourceName: string | undefined,
  derived: ReturnType<typeof blendTheme>
) {
  return `import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function ${(
    sourceName ?? "Chimera"
  ).replace(/[^a-zA-Z0-9]/g, "")}Preset() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Derived theme</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input placeholder="Search" />
          <div className="flex gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Secondary</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}`
}

function makeUploadedSource(file: File, template: (typeof themeLibrary)[number]) {
  const stem = file.name.replace(/\.[^.]+$/, "")
  return {
    ...template,
    id: `upload-${crypto.randomUUID()}`,
    name: stem,
    blurb: `Uploaded source · ${file.type || "image"}`,
    imageUrl: URL.createObjectURL(file),
    origin: "Local upload",
    category: "mixed" as const,
  }
}

function ActiveSourceRow(props: {
  source: (typeof themeLibrary)[number]
  index: number
  isSelected: boolean
  isPinned: boolean
  onSelect: () => void
  onTogglePin: () => void
  onReroll: () => void
}) {
  const sortable = useSortable({ id: props.source.id })

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border px-2 py-2 text-left text-xs transition ${
        props.isSelected
          ? "bg-accent text-accent-foreground"
          : "bg-background hover:bg-accent/40"
      }`}
      data-testid={`active-target-${props.index + 1}`}
    >
      <button
        type="button"
        className="flex h-8 cursor-grab touch-none items-center justify-center border bg-muted/50 text-[10px] text-muted-foreground"
        aria-label={`Reorder ${props.source.name}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        {props.index + 1}
      </button>
      <button
        type="button"
        className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)] items-center gap-2 text-left"
        onClick={props.onSelect}
      >
        <span className="flex h-9 overflow-hidden border bg-muted">
          <img
            src={props.source.imageUrl}
            alt={props.source.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {props.source.name}
          </span>
          <span className="block truncate text-muted-foreground">
            {props.source.category} · {props.source.blurb}
          </span>
        </span>
      </button>
      <span className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={(event) => {
            event.stopPropagation()
            props.onTogglePin()
          }}
        >
          <Pin className={props.isPinned ? "fill-current" : ""} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={(event) => {
            event.stopPropagation()
            props.onReroll()
          }}
        >
          <RefreshCw />
        </Button>
      </span>
    </div>
  )
}

function LibrarySourceRow(props: {
  source: (typeof themeLibrary)[number]
  isActive: boolean
  onAssign: () => void
}) {
  const draggable = useDraggable({
    id: `library:${props.source.id}`,
    data: {
      kind: "library-source",
      sourceId: props.source.id,
    },
  })

  return (
    <button
      ref={draggable.setNodeRef}
      type="button"
      className={`grid grid-cols-[24px_40px_minmax(0,1fr)_auto] items-center gap-3 border bg-card px-3 py-2 text-left transition hover:bg-accent/40 ${
        draggable.isDragging ? "opacity-60 shadow-sm" : ""
      }`}
      style={{
        transform: CSS.Translate.toString(draggable.transform),
      }}
      onClick={props.onAssign}
    >
      <span
        className="flex h-8 cursor-grab touch-none items-center justify-center border bg-muted/50 text-[10px] text-muted-foreground"
        {...draggable.attributes}
        {...draggable.listeners}
      >
        ::
      </span>
      <span className="flex h-10 overflow-hidden border bg-muted">
        <img
          src={props.source.imageUrl}
          alt={props.source.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {props.source.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {props.source.category} · {props.source.origin} · {props.source.blurb}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">
        {props.isActive ? "Replace" : "Assign"}
      </span>
    </button>
  )
}

export default function App() {
  const [sourceLibrary, setSourceLibrary] = useState(themeLibrary)
  const [state, setState] = useState<AppState>(() => {
    try {
      return runSync(loadInitialState(libraryIds))
    } catch (error) {
      console.error("App initialization failed", error)
      return fallbackState()
    }
  })
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [sourceCategory, setSourceCategory] = useState<SourceCategory>("all")
  const [isFileDropActive, setIsFileDropActive] = useState(false)
  const [leftWidth, setLeftWidth] = useState(392)
  const [centerTopHeight, setCenterTopHeight] = useState(320)
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragDepthRef = useRef(0)
  const dragStateRef = useRef<
    | { kind: "probe" }
    | { kind: "source"; sourceId: string }
    | null
  >(null)
  const resizeStateRef = useRef<
    | { side: "left"; startX: number; startWidth: number }
    | { side: "center"; startY: number; startHeight: number }
    | null
  >(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8,
      },
    })
  )
  const sourceMap = useMemo(
    () => new Map(sourceLibrary.map((source) => [source.id, source])),
    [sourceLibrary]
  )
  const currentLibraryIds = useMemo(
    () => sourceLibrary.map((source) => source.id),
    [sourceLibrary]
  )

  const activeSources = useMemo(
    () =>
      state.activeIds
        .map((id) => sourceMap.get(id))
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [sourceMap, state.activeIds]
  )

  const derived = useMemo(
    () =>
      blendTheme({
        targets: activeSources,
        point: state.point,
        blendSharpness: state.controls.blendSharpness,
        snapStrength: state.controls.snapStrength,
        contrastGuard: state.controls.contrastGuard,
      }),
    [
      activeSources,
      state.controls.blendSharpness,
      state.controls.contrastGuard,
      state.controls.snapStrength,
      state.point,
    ]
  )

  const dominantSource = sourceMap.get(derived.dominantTargetId)
  const selectedSource = state.selectedTargetId
    ? sourceMap.get(state.selectedTargetId)
    : dominantSource
  const visibleSources = useMemo(
    () =>
      sourceCategory === "all"
        ? sourceLibrary
        : sourceLibrary.filter((source) => source.category === sourceCategory),
    [sourceCategory, sourceLibrary]
  )
  const themeCss = useMemo(
    () => buildThemeCss(state.seed, dominantSource?.name, derived),
    [derived, dominantSource?.name, state.seed]
  )
  const componentSnippet = useMemo(
    () => buildComponentSnippet(dominantSource?.name, derived),
    [derived, dominantSource?.name]
  )

  const ingestFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))
    if (imageFiles.length === 0) return

    setSourceLibrary((current) => [
      ...imageFiles.map((file, index) =>
        makeUploadedSource(
          file,
          current[index % current.length] ?? themeLibrary[index % themeLibrary.length]
        )
      ),
      ...current,
    ])
    setLibraryOpen(true)
    setSourceCategory("all")
    setState((current) => ({
      ...current,
      status: `Imported ${imageFiles.length} custom source${imageFiles.length === 1 ? "" : "s"}.`,
    }))
  }

  const exportCurrentSystem = () => {
    downloadJson(`chimera-system-${state.seed}.json`, {
      seed: state.seed,
      activeIds: state.activeIds,
      point: state.point,
      selectedTargetId: state.selectedTargetId,
      derived,
    })
    setState((current) => ({
      ...current,
      status: "Exported JSON.",
    }))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return

    setState((current) => {
      const oldIndex = current.activeIds.indexOf(activeId)
      const newIndex = current.activeIds.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return current
      return {
        ...current,
        activeIds: arrayMove(current.activeIds, oldIndex, newIndex),
        status: "Reordered active sources.",
      }
    })
  }

  const fieldPointFromEvent = (event: PointerEvent | React.PointerEvent) => {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    }
  }

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (resizeStateRef.current) {
        if (resizeStateRef.current.side === "left") {
          setLeftWidth(
            clamp(
              resizeStateRef.current.startWidth +
                (event.clientX - resizeStateRef.current.startX),
              320,
              520
            )
          )
        } else {
          setCenterTopHeight(
            clamp(
              resizeStateRef.current.startHeight +
                (event.clientY - resizeStateRef.current.startY),
              220,
              560
            )
          )
        }
        return
      }

      const point = fieldPointFromEvent(event)
      if (!point || !dragStateRef.current) return

      if (dragStateRef.current.kind === "probe") {
        setState((current) => ({
          ...current,
          point,
        }))
        return
      }

      if (dragStateRef.current.kind === "source") {
        const sourceId = dragStateRef.current.sourceId
        setSourceLibrary((current) =>
          current.map((source) =>
            source.id === sourceId
              ? {
                  ...source,
                  position: point,
                }
              : source
          )
        )
      }
    }

    const clearDrag = () => {
      dragStateRef.current = null
      resizeStateRef.current = null
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", clearDrag)
    window.addEventListener("pointercancel", clearDrag)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", clearDrag)
      window.removeEventListener("pointercancel", clearDrag)
    }
  }, [])

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files")

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current += 1
      setIsFileDropActive(true)
    }

    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
    }

    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) {
        setIsFileDropActive(false)
      }
    }

    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current = 0
      setIsFileDropActive(false)
      ingestFiles(Array.from(event.dataTransfer?.files ?? []))
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)

    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target && ["INPUT", "TEXTAREA"].includes(target.tagName)
      if (isTyping) return

      if (event.key.toLowerCase() === "r" && event.shiftKey) {
        event.preventDefault()
        setState((current) =>
          runSync(reshuffleActiveSet({ state: current, libraryIds: currentLibraryIds }))
        )
        return
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault()
        setState((current) =>
          runSync(randomizeActiveSet({ state: current, libraryIds: currentLibraryIds }))
        )
        return
      }

      const numeric = Number.parseInt(event.key, 10)
      if (
        !Number.isNaN(numeric) &&
        numeric >= 1 &&
        numeric <= state.activeIds.length
      ) {
        event.preventDefault()
        const targetId = state.activeIds[numeric - 1]
        setState((current) =>
          runSync(rerollOneTarget({ state: current, libraryIds: currentLibraryIds, targetId }))
        )
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [currentLibraryIds, state.activeIds])

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-foreground">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `${leftWidth}px 8px minmax(0,1fr)`,
        }}
      >
        <aside className="flex h-full min-w-0 flex-col border-r bg-sidebar" data-testid="left-pane">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h1 className="text-sm font-medium">Chimera VoidZero</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  References in, theme out
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    ingestFiles(Array.from(event.target.files ?? []))
                    event.currentTarget.value = ""
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus />
                  Add images
                </Button>
                <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen />
                    Sources
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl">
                  <DialogHeader>
                    <DialogTitle>Source corpus</DialogTitle>
                    <DialogDescription>
                      Import or replace references.
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs
                    value={sourceCategory}
                    onValueChange={(value) => setSourceCategory(value as SourceCategory)}
                    className="gap-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <TabsList variant="line">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="ui">UI</TabsTrigger>
                        <TabsTrigger value="editorial">Editorial</TabsTrigger>
                        <TabsTrigger value="mixed">Mixed</TabsTrigger>
                      </TabsList>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <ImagePlus className="size-4" />
                        Add images
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? [])
                            if (files.length === 0) return
                            ingestFiles(files)
                            event.currentTarget.value = ""
                          }}
                        />
                      </label>
                    </div>
                  <div className="grid max-h-[70vh] grid-cols-1 gap-2 overflow-hidden md:grid-cols-2">
                    <ScrollArea className="h-[62vh] pr-3 md:col-span-2">
                      <div className="grid gap-2" data-testid="source-corpus">
                        {visibleSources.map((source) => {
                          const isActive = state.activeIds.includes(source.id)
                          return (
                            <button
                              key={source.id}
                              type="button"
                              className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border bg-card px-3 py-2 text-left transition hover:bg-accent/40"
                              onClick={() => {
                                setState((current) =>
                                  runSync(
                                    assignTarget({
                                      state: current,
                                      themeId: source.id,
                                    })
                                  )
                                )
                                setLibraryOpen(false)
                              }}
                            >
                              <span className="flex h-10 overflow-hidden border bg-muted">
                                <img
                                  src={source.imageUrl}
                                  alt={source.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {source.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {source.category} · {source.origin} · {source.blurb}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {isActive ? "Active" : "Assign"}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                  </Tabs>
                </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs text-muted-foreground">
                    Active seed
                  </div>
                  <div
                    className="truncate font-mono text-sm"
                    data-testid="seed-display"
                  >
                    {state.seed}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="randomize-button"
                    onClick={() =>
                      setState((current) =>
                        runSync(randomizeActiveSet({ state: current, libraryIds: currentLibraryIds }))
                      )
                    }
                  >
                    <RefreshCw />
                    Mix
                  </Button>
                  <Button
                    size="sm"
                    data-testid="reshuffle-button"
                    onClick={() =>
                      setState((current) =>
                        runSync(reshuffleActiveSet({ state: current, libraryIds: currentLibraryIds }))
                      )
                    }
                  >
                    <Sparkles />
                    New seed
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="grid gap-4 p-4">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Active sources</CardTitle>
                    <CardDescription>
                      Current reference set.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-1" data-testid="active-sources-list">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={activeSources.map((source) => source.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {activeSources.map((source, index) => (
                          <ActiveSourceRow
                            key={source.id}
                            source={source}
                            index={index}
                            isSelected={state.selectedTargetId === source.id}
                            isPinned={state.pinnedIds.includes(source.id)}
                            onSelect={() =>
                              setState((current) => ({
                                ...current,
                                selectedTargetId: source.id,
                              }))
                            }
                            onTogglePin={() =>
                              setState((current) => ({
                                ...current,
                                pinnedIds: current.pinnedIds.includes(source.id)
                                  ? current.pinnedIds.filter((id) => id !== source.id)
                                  : [...current.pinnedIds, source.id],
                              }))
                            }
                            onReroll={() =>
                              setState((current) =>
                                runSync(
                                  rerollOneTarget({
                                    state: current,
                                    libraryIds: currentLibraryIds,
                                    targetId: source.id,
                                  })
                                )
                              )
                            }
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader>
                    <CardTitle>System controls</CardTitle>
                    <CardDescription>
                      Blend controls.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Sharpness</span>
                        <span data-testid="sharpness-slider-value">
                          {state.controls.blendSharpness.toFixed(2)}x
                        </span>
                      </div>
                      <Slider
                        value={[state.controls.blendSharpness]}
                        min={1}
                        max={2.4}
                        step={0.05}
                        onValueChange={([value]) =>
                          setState((current) => ({
                            ...current,
                            controls: {
                              ...current.controls,
                              blendSharpness: value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Snap strength</span>
                        <span>{Math.round(state.controls.snapStrength * 100)}%</span>
                      </div>
                      <Slider
                        value={[state.controls.snapStrength]}
                        min={0}
                        max={0.8}
                        step={0.05}
                        onValueChange={([value]) =>
                          setState((current) => ({
                            ...current,
                            controls: {
                              ...current.controls,
                              snapStrength: value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Active source count</span>
                        <span>{state.controls.activeCount}</span>
                      </div>
                      <Slider
                        value={[state.controls.activeCount]}
                        min={3}
                        max={10}
                        step={1}
                        onValueChange={([value]) =>
                          setState((current) =>
                            runSync(
                              randomizeActiveSet({
                                state: {
                                  ...current,
                                  controls: {
                                    ...current.controls,
                                    activeCount: value,
                                  },
                                },
                                libraryIds: currentLibraryIds,
                              })
                            )
                          )
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
        </aside>

        <div
          className="cursor-col-resize border-r bg-border/60 transition hover:bg-foreground/15"
          data-testid="left-resize-handle"
          onPointerDown={(event) => {
            resizeStateRef.current = {
              side: "left",
              startX: event.clientX,
              startWidth: leftWidth,
            }
            document.body.style.cursor = "col-resize"
            document.body.style.userSelect = "none"
          }}
        />

        <main className="flex h-full min-w-0 flex-col bg-[oklch(0.98_0.01_85)]" data-testid="center-pane">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  Current system
                </div>
                <div className="text-sm font-medium">
                  {dominantSource?.name ?? "Derived output"} ·{" "}
                  {derived.contrast.toFixed(1)}:1 contrast
                </div>
              </div>
              <Button
                size="sm"
                data-testid="save-blend-button"
                onClick={() =>
                  setState((current) =>
                    runSync(
                      saveBlendState({
                        state: current,
                        entry: createSavedState(current, derived.tokens),
                      })
                    )
                  )
                }
              >
                <BookmarkPlus />
                Save system
              </Button>
              <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Inspect
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Inspector</DialogTitle>
                    <DialogDescription>
                      Source details and extracted signals.
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="overview" className="flex min-h-0 flex-col">
                    <TabsList variant="line">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="signals">Signals</TabsTrigger>
                      <TabsTrigger value="saved">Saved</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="min-h-0 flex-1">
                      <ScrollArea className="h-[60vh]">
                        <div className="grid gap-4 p-1">
                          <Card size="sm">
                            <CardHeader>
                              <CardTitle>Selected source</CardTitle>
                              <CardDescription>
                                Current reference.
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                              <div className="flex h-28 overflow-hidden border bg-muted">
                                {selectedSource ? (
                                  <img
                                    src={selectedSource.imageUrl}
                                    alt={selectedSource.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : null}
                              </div>
                              <div>
                                <div className="text-sm font-medium">
                                  {selectedSource?.name ?? "Unknown"}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {selectedSource?.blurb ??
                                    "Select a reference."}
                                </p>
                                {selectedSource ? (
                                  <p className="mt-2 text-[11px] text-muted-foreground">
                                    {selectedSource.category} · {selectedSource.origin}
                                  </p>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>

                          <Card size="sm">
                            <CardHeader>
                              <CardTitle>Current state</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span>Status</span>
                                <span className="text-right text-muted-foreground">
                                  {state.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Seed</span>
                                <span className="font-mono">{state.seed}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Position</span>
                                <span className="font-mono">
                                  {state.point.x.toFixed(2)} × {state.point.y.toFixed(2)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="signals" className="min-h-0 flex-1">
                      <ScrollArea className="h-[60vh]">
                        <div className="grid gap-4 p-1">
                          <Card size="sm">
                            <CardHeader>
                              <CardTitle>Extracted signals</CardTitle>
                              <CardDescription>
                                Explain the current system instead of forcing the user to infer it from color alone.
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span>Font family</span>
                                <span>{derived.discrete.fontFamily}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Density</span>
                                <span>{derived.discrete.density}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Button treatment</span>
                                <span>{derived.discrete.buttonStyle}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Hero size</span>
                                <span>{Math.round(derived.tokens.heroSize)} px</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Radius</span>
                                <span>{Math.round(derived.tokens.radius)} px</span>
                              </div>
                            </CardContent>
                          </Card>

                          <Card size="sm">
                            <CardHeader>
                              <CardTitle>Top influences</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-2">
                              {derived.weights.slice(0, 6).map((item) => (
                                <div key={item.id} className="grid gap-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span>{item.name}</span>
                                    <span>{Math.round(item.weight * 100)}%</span>
                                  </div>
                                  <div className="h-2 bg-border">
                                    <div
                                      className="h-full bg-foreground"
                                      style={{ width: `${item.weight * 100}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="saved" className="min-h-0 flex-1">
                      <ScrollArea className="h-[60vh]">
                        <div className="grid gap-3 p-1" data-testid="saved-states">
                          {state.savedStates.length === 0 ? (
                            <Card size="sm">
                              <CardContent className="pt-4 text-xs text-muted-foreground">
                                No saved presets.
                              </CardContent>
                            </Card>
                          ) : (
                            state.savedStates.map((saved) => (
                              <Card key={saved.id} size="sm">
                                <CardContent className="grid gap-3 pt-4">
                                  <div>
                                    <div className="text-sm font-medium">
                                      {saved.label}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {saved.activeIds.length} sources · {saved.seed}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setState((current) => ({
                                          ...current,
                                          seed: saved.seed,
                                          activeIds: saved.activeIds,
                                          point: saved.point,
                                          selectedTargetId: saved.activeIds[0] ?? null,
                                          status: `"${saved.label}" loaded.`,
                                        }))
                                      }
                                    >
                                      <Crosshair />
                                      Load
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setState((current) =>
                                          runSync(
                                            removeSavedBlendState({
                                              state: current,
                                              id: saved.id,
                                            })
                                          )
                                        )
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>

            <div
              className="grid h-full min-h-0 p-3"
              style={{
                gridTemplateRows: `${centerTopHeight}px 8px minmax(0,1fr)`,
              }}
            >
              <Card className="min-h-0 overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Navigator</CardTitle>
                      <CardDescription>
                        Drag the probe and tags.
                      </CardDescription>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div data-testid="blend-coordinates">
                        {state.point.x.toFixed(2)} × {state.point.y.toFixed(2)}
                      </div>
                      <div>{activeSources.length} active sources</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid h-[calc(100%-57px)] min-h-0 grid-rows-[minmax(0,1fr)_96px] p-0">
                  <div
                    ref={fieldRef}
                    className="relative min-h-0 select-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, transparent 39px, rgba(0,0,0,0.08) 40px), linear-gradient(to bottom, transparent 39px, rgba(0,0,0,0.08) 40px)",
                      backgroundSize: "40px 40px",
                      WebkitUserSelect: "none",
                      touchAction: "none",
                    }}
                    role="slider"
                    aria-label="Blend position"
                    tabIndex={0}
                    data-testid="inspiration-field"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      const point = fieldPointFromEvent(event)
                      if (!point) return
                      dragStateRef.current = { kind: "probe" }
                      setState((current) => ({
                        ...current,
                        point,
                      }))
                    }}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 0.05 : 0.025
                      if (event.key === "ArrowLeft")
                        setState((current) => ({
                          ...current,
                          point: {
                            x: clamp(current.point.x - step),
                            y: current.point.y,
                          },
                        }))
                      if (event.key === "ArrowRight")
                        setState((current) => ({
                          ...current,
                          point: {
                            x: clamp(current.point.x + step),
                            y: current.point.y,
                          },
                        }))
                      if (event.key === "ArrowUp")
                        setState((current) => ({
                          ...current,
                          point: {
                            x: current.point.x,
                            y: clamp(current.point.y - step),
                          },
                        }))
                      if (event.key === "ArrowDown")
                        setState((current) => ({
                          ...current,
                          point: {
                            x: current.point.x,
                            y: clamp(current.point.y + step),
                          },
                        }))
                    }}
                  >
                    {activeSources.map((source) => {
                      const weight =
                        derived.weights.find((item) => item.id === source.id)
                          ?.weight ?? 0
                      return (
                        <button
                          key={source.id}
                          type="button"
                          className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center gap-2 border bg-background px-2 py-1 text-left text-[11px] shadow-sm select-none active:cursor-grabbing ${
                            state.selectedTargetId === source.id
                              ? "border-foreground"
                              : "border-border"
                          }`}
                          style={{
                            left: `${source.position.x * 100}%`,
                            top: `${source.position.y * 100}%`,
                            WebkitUserSelect: "none",
                          }}
                          onPointerDown={(event) => {
                            event.stopPropagation()
                            event.preventDefault()
                            event.currentTarget.setPointerCapture(event.pointerId)
                            dragStateRef.current = {
                              kind: "source",
                              sourceId: source.id,
                            }
                            setState((current) => ({
                              ...current,
                              selectedTargetId: source.id,
                            }))
                          }}
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              selectedTargetId: source.id,
                            }))
                          }
                          data-testid={`field-node-${source.id}`}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ background: source.tokens.accent }}
                          />
                          <span className="max-w-28 truncate">
                            {source.name}
                          </span>
                          <span className="text-muted-foreground">
                            {Math.round(weight * 100)}%
                          </span>
                        </button>
                      )
                    })}
                    <div
                      className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background shadow-[0_0_0_4px_rgba(0,0,0,0.08)]"
                      style={{
                        left: `${state.point.x * 100}%`,
                        top: `${state.point.y * 100}%`,
                      }}
                      data-testid="field-probe"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-0 border-t">
                    {derived.weights.slice(0, 4).map((item) => (
                      <div key={item.id} className="grid gap-1 border-r px-3 py-2 last:border-r-0">
                        <div className="truncate text-[11px] text-muted-foreground">
                          {item.name}
                        </div>
                        <div className="text-sm font-medium">
                          {Math.round(item.weight * 100)}%
                        </div>
                        <div className="h-1.5 bg-border">
                          <div
                            className="h-full bg-foreground"
                            style={{ width: `${item.weight * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div
                className="cursor-row-resize bg-border/60 transition hover:bg-foreground/15"
                data-testid="center-resize-handle"
                onPointerDown={(event) => {
                  resizeStateRef.current = {
                    side: "center",
                    startY: event.clientY,
                    startHeight: centerTopHeight,
                  }
                  document.body.style.cursor = "row-resize"
                  document.body.style.userSelect = "none"
                }}
              />
              <Card className="min-h-0 overflow-hidden">
                <CardContent className="flex h-full min-h-0 flex-col p-0">
                  <Tabs defaultValue="preview" className="flex h-full min-h-0 flex-col">
                    <div className="border-b px-4 py-3">
                      <TabsList variant="line">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="theme">Theme</TabsTrigger>
                        <TabsTrigger value="code">Code</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="preview" className="min-h-0 flex-1">
                      <ScrollArea className="h-full">
                        <div
                          className="m-4 overflow-hidden border bg-card"
                          data-testid="preview-surface"
                          style={{
                            fontFamily: fontStack(derived.discrete.fontFamily),
                            color: derived.tokens.text,
                            background: derived.tokens.background,
                            borderColor: derived.tokens.border,
                          }}
                        >
                      <div
                        className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-4 text-xs"
                        style={{ background: derived.tokens.surface }}
                      >
                        <div className="flex items-center gap-5">
                          <strong className="text-sm font-medium">
                            Preview
                          </strong>
                          <span>Theme</span>
                          <span>Code</span>
                          <span>Saved</span>
                        </div>
                        <Button size="sm" onClick={exportCurrentSystem}>
                          Export
                        </Button>
                      </div>
                      <div
                        className="grid grid-cols-[minmax(0,1.2fr)_260px] gap-4 border-b px-5 py-5"
                        style={{
                          background: `linear-gradient(135deg, ${derived.tokens.heroGradientA}, ${derived.tokens.heroGradientB})`,
                        }}
                      >
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {dominantSource?.name ?? "Derived output"}
                          </div>
                          <h2
                            className="mt-2 max-w-xl leading-none"
                            style={{
                              fontSize: `${derived.tokens.heroSize}px`,
                              fontWeight: derived.tokens.heroWeight,
                              letterSpacing: `${derived.tokens.tracking}em`,
                            }}
                          >
                            {formatCase(
                              "Derived theme",
                              derived.discrete.heroCase
                            )}
                          </h2>
                          <p
                            className="mt-4 max-w-2xl"
                            style={{
                              fontSize: `${derived.tokens.bodySize}px`,
                              color: derived.tokens.muted,
                              lineHeight: derived.tokens.lineHeight,
                            }}
                          >
                            Fixed preview with current tokens.
                          </p>
                        </div>
                        <div className="grid gap-3">
                          {derived.weights.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              className="border px-3 py-3"
                              style={{
                                background: derived.tokens.surface,
                                borderColor: derived.tokens.border,
                              }}
                            >
                              <div className="text-[11px] text-muted-foreground">
                                {item.name}
                              </div>
                              <div className="mt-1 text-2xl font-medium">
                                {Math.round(item.weight * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 px-5 py-5">
                        <div className="grid gap-4">
                          <div
                            className="border px-4 py-4"
                            style={{
                              background: derived.tokens.surface,
                              borderColor: derived.tokens.border,
                            }}
                          >
                            <div className="text-xs text-muted-foreground">
                              Policy
                            </div>
                            <div
                              className="mt-2"
                              style={{
                                fontSize: `${derived.tokens.titleSize}px`,
                                fontWeight: derived.tokens.titleWeight,
                              }}
                            >
                              Distance-weighted blend
                            </div>
                            <p
                              className="mt-3"
                              style={{
                                fontSize: `${derived.tokens.bodySize}px`,
                                color: derived.tokens.muted,
                              }}
                            >
                              Current references drive this token set.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div
                              className="border px-4 py-4"
                              style={{
                                background: derived.tokens.surface,
                                borderColor: derived.tokens.border,
                              }}
                            >
                              <div className="text-xs text-muted-foreground">
                                Active system
                              </div>
                              <div className="mt-3 grid gap-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Seed</span>
                                  <span className="font-mono">{state.seed}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Selected source</span>
                                  <span>{selectedSource?.name ?? "None"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Probe</span>
                                  <span className="font-mono">
                                    {state.point.x.toFixed(2)} × {state.point.y.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div
                              className="border px-4 py-4"
                              style={{
                                background: derived.tokens.surface,
                                borderColor: derived.tokens.border,
                              }}
                            >
                              <div className="text-xs text-muted-foreground">
                                Actions
                              </div>
                              <div className="mt-3 grid gap-2">
                                <Button onClick={exportCurrentSystem}>Export tokens</Button>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    setState((current) =>
                                      runSync(
                                        saveBlendState({
                                          state: current,
                                          entry: createSavedState(current, derived.tokens),
                                        })
                                      )
                                    )
                                  }
                                >
                                  Save current system
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid content-start gap-3">
                          <div
                            className="border px-4 py-4"
                            style={{
                              background: derived.tokens.surface,
                              borderColor: derived.tokens.border,
                            }}
                          >
                            <div className="text-xs text-muted-foreground">
                              Active typography
                            </div>
                            <div className="mt-2 text-sm font-medium">
                              {derived.discrete.fontFamily} · {derived.discrete.density}
                            </div>
                          </div>
                          <div
                            className="border px-4 py-4"
                            style={{
                              background: derived.tokens.surface,
                              borderColor: derived.tokens.border,
                            }}
                          >
                            <div className="text-xs text-muted-foreground">
                              Contrast
                            </div>
                            <div className="mt-2 text-sm font-medium">
                              {derived.contrast.toFixed(1)} : 1
                            </div>
                          </div>
                          <div
                            className="border px-4 py-4"
                            style={{
                              background: derived.tokens.surface,
                              borderColor: derived.tokens.border,
                            }}
                          >
                            <div className="text-xs text-muted-foreground">
                              Dominant source
                            </div>
                            <div className="mt-2 text-sm font-medium">
                              {dominantSource?.name ?? "Unknown"}
                            </div>
                          </div>
                        </div>
                      </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="theme" className="min-h-0 flex-1">
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="flex items-center justify-between border-b px-4 py-3 text-xs">
                          <div>
                            Tailwind v4 + shadcn token block
                          </div>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await copyText(themeCss)
                              setState((current) => ({
                                ...current,
                                status: "Copied theme.",
                              }))
                            }}
                          >
                            Copy theme
                          </Button>
                        </div>
                        <ScrollArea className="h-full">
                          <pre className="p-4 text-xs leading-6 whitespace-pre-wrap">
                            <code>{themeCss}</code>
                          </pre>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                    <TabsContent value="code" className="min-h-0 flex-1">
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="flex items-center justify-between border-b px-4 py-3 text-xs">
                          <div>
                            Starter component scaffold
                          </div>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await copyText(componentSnippet)
                              setState((current) => ({
                                ...current,
                                status: "Copied component code.",
                              }))
                            }}
                          >
                            Copy code
                          </Button>
                        </div>
                        <ScrollArea className="h-full">
                          <pre className="p-4 text-xs leading-6 whitespace-pre-wrap">
                            <code>{componentSnippet}</code>
                          </pre>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
        </main>

      </div>
      {isFileDropActive ? (
        <div className="pointer-events-none fixed inset-0 z-50 grid grid-cols-[392px_minmax(0,1fr)] bg-black/30 backdrop-blur-[1px]">
          <div className="border-r border-white/20 bg-white/85 p-6">
            <div className="flex h-full flex-col justify-between border-2 border-dashed border-foreground/40 p-6">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Import
                </div>
                <h2 className="mt-3 text-2xl font-medium">
                  Drop images to add references
                </h2>
                <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                  They will appear in the source library immediately.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Drop anywhere in the window.
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-8 border border-white/20" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
