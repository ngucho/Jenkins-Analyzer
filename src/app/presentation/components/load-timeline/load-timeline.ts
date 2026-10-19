import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Build, buildDuration } from '@domain/build';
import { LoadPoint } from '@domain/analytics/load-series';
import { IdleSlot } from '@domain/analytics/occupancy';
import { TimeWindow, windowDuration } from '@domain/time-window';
import { RESULT_LABELS, resultClass } from '../../shared/build-result';
import { formatDateTime, formatDuration, formatRange, formatShortDate } from '../../shared/format';
import { packLanes } from '../../shared/chart/lane-layout';
import { timeTicks } from '../../shared/chart/time-ticks';

const MARGIN = { left: 40, right: 16 };
const AXIS_HEIGHT = 28;
const LOAD_HEIGHT = 140;
const SECTION_GAP = 20;
const LANE_HEIGHT = 10;
const LANE_GAP = 3;
const MIN_DRAG_PX = 6;
const MIN_BUILD_PX = 1.5;

interface Hover {
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly lines: readonly string[];
}

@Component({
  selector: 'app-load-timeline',
  templateUrl: './load-timeline.html',
  styleUrl: './load-timeline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadTimeline {
  readonly window = input.required<TimeWindow>();
  readonly series = input.required<readonly LoadPoint[]>();
  readonly builds = input.required<readonly Build[]>();
  readonly idleSlots = input.required<readonly IdleSlot[]>();
  readonly capacity = input(0);
  readonly zoomRequest = output<TimeWindow>();

  protected readonly margin = MARGIN;
  protected readonly laneHeight = LANE_HEIGHT;
  protected readonly axisHeight = AXIS_HEIGHT;

  protected readonly width = signal(800);
  protected readonly hover = signal<Hover | null>(null);
  private readonly dragStart = signal<number | null>(null);
  private readonly dragCurrent = signal<number | null>(null);

  protected readonly plotWidth = computed(() => Math.max(1, this.width() - MARGIN.left - MARGIN.right));
  protected readonly lanes = computed(() => packLanes(this.builds()));
  protected readonly ganttTop = AXIS_HEIGHT + LOAD_HEIGHT + SECTION_GAP;
  protected readonly height = computed(
    () => this.ganttTop + Math.max(1, this.lanes().length) * (LANE_HEIGHT + LANE_GAP) + 8,
  );
  protected readonly loadBottom = AXIS_HEIGHT + LOAD_HEIGHT;

  /** Échelle verticale : au moins la capacité, pour voir la marge disponible. */
  private readonly yMax = computed(() =>
    Math.max(1, this.capacity(), ...this.series().map((point) => point.peakLoad)),
  );

  protected readonly yTicks = computed(() => {
    const max = this.yMax();
    const values = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
    return values.map((value) => ({ value, y: this.y(value) }));
  });

  protected readonly xTicks = computed(() =>
    timeTicks(this.window(), Math.max(2, Math.floor(this.plotWidth() / 90))).map((tick) => ({
      ...tick,
      x: this.x(tick.time),
    })),
  );

  protected readonly averagePath = computed(() => this.stepPath((p) => p.averageLoad, true));
  protected readonly peakPath = computed(() => this.stepPath((p) => p.peakLoad, false));
  protected readonly capacityY = computed(() => (this.capacity() > 0 ? this.y(this.capacity()) : null));

  protected readonly idleBands = computed(() =>
    this.idleSlots().map((slot) => ({
      x: this.x(slot.start),
      width: Math.max(1, this.x(slot.end) - this.x(slot.start)),
    })),
  );

  protected readonly buildBars = computed(() =>
    this.lanes().flatMap((lane, index) =>
      lane.map((build) => {
        const x = this.x(Math.max(build.start, this.window().start));
        const end = this.x(Math.min(build.end, this.window().end));
        return {
          id: build.id,
          x,
          y: this.ganttTop + index * (LANE_HEIGHT + LANE_GAP),
          width: Math.max(MIN_BUILD_PX, end - x),
          className: resultClass(build.result),
        };
      }),
    ),
  );

  protected readonly selection = computed(() => {
    const start = this.dragStart();
    const current = this.dragCurrent();
    if (start === null || current === null) return null;
    return { x: Math.min(start, current), width: Math.abs(current - start) };
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected onPointerDown(event: PointerEvent): void {
    const x = this.pointerX(event);
    if (x < MARGIN.left) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.dragStart.set(x);
    this.dragCurrent.set(x);
  }

  protected onPointerMove(event: PointerEvent): void {
    const x = this.clampX(this.pointerX(event));
    if (this.dragStart() !== null) {
      this.dragCurrent.set(x);
      this.hover.set(null);
      return;
    }
    this.hover.set(this.describe(x, this.pointerY(event)));
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.dragStart();
    const end = this.clampX(this.pointerX(event));
    this.dragStart.set(null);
    this.dragCurrent.set(null);
    if (start === null) return;

    if (Math.abs(end - start) >= MIN_DRAG_PX) {
      this.zoomRequest.emit({ start: this.time(Math.min(start, end)), end: this.time(Math.max(start, end)) });
    } else {
      const build = this.buildAt(end, this.pointerY(event));
      if (build && build.url !== '#') window.open(build.url, '_blank', 'noopener');
    }
  }

  protected onPointerLeave(): void {
    if (this.dragStart() === null) this.hover.set(null);
  }

  private x(time: number): number {
    const window = this.window();
    return MARGIN.left + ((time - window.start) / windowDuration(window)) * this.plotWidth();
  }

  private time(x: number): number {
    const window = this.window();
    return window.start + ((x - MARGIN.left) / this.plotWidth()) * windowDuration(window);
  }

  private y(load: number): number {
    return this.loadBottom - (load / this.yMax()) * (LOAD_HEIGHT - 8);
  }

  private clampX(x: number): number {
    return Math.min(Math.max(x, MARGIN.left), MARGIN.left + this.plotWidth());
  }

  private pointerX(event: PointerEvent): number {
    return event.clientX - (event.currentTarget as Element).getBoundingClientRect().left;
  }

  private pointerY(event: PointerEvent): number {
    return event.clientY - (event.currentTarget as Element).getBoundingClientRect().top;
  }

  /** Tracé « en escalier » d'une série ; fermé vers l'axe pour une aire. */
  private stepPath(value: (point: LoadPoint) => number, closed: boolean): string {
    const points = this.series();
    if (points.length === 0) return '';
    const steps = points.map((p) => `L${this.x(p.start)},${this.y(value(p))}H${this.x(p.end)}`).join('');
    const first = `M${this.x(points[0].start)},${closed ? this.loadBottom : this.y(value(points[0]))}`;
    const close = closed ? `V${this.loadBottom}Z` : '';
    return first + steps + close;
  }

  private buildAt(x: number, y: number): Build | null {
    const lane = Math.floor((y - this.ganttTop) / (LANE_HEIGHT + LANE_GAP));
    if (y < this.ganttTop || lane >= this.lanes().length) return null;
    const tolerance = (3 / this.plotWidth()) * windowDuration(this.window());
    const time = this.time(x);
    return (
      this.lanes()[lane].find((b) => b.start - tolerance <= time && time <= b.end + tolerance) ?? null
    );
  }

  private describe(x: number, y: number): Hover | null {
    const build = this.buildAt(x, y);
    if (build) {
      return {
        x,
        y,
        title: `${build.jobName} #${build.number}`,
        lines: [
          `${RESULT_LABELS[build.result]} · ${formatDuration(buildDuration(build))}`,
          `${formatShortDate(build.start)} · ${formatRange(build.start, build.end)}`,
          ...(build.node ? [`Nœud : ${build.node}`] : []),
        ],
      };
    }
    if (y > this.loadBottom || y < AXIS_HEIGHT) return null;

    const time = this.time(x);
    const point = this.series().find((p) => p.start <= time && time < p.end);
    const idle = this.idleSlots().find((slot) => slot.start <= time && time < slot.end);
    if (!point) return null;
    return {
      x,
      y,
      title: formatDateTime(time),
      lines: [
        `Charge moyenne : ${point.averageLoad.toFixed(1)} · pic : ${point.peakLoad}`,
        ...(idle ? [`Plage creuse de ${formatDuration(idle.duration)} (${formatRange(idle.start, idle.end)})`] : []),
      ],
    };
  }
}
