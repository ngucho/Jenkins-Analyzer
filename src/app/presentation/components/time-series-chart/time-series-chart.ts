import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { TimeWindow, windowDuration } from '@domain/time-window';
import { packLanes } from '../../shared/chart/lane-layout';
import { timeTicks } from '../../shared/chart/time-ticks';
import { formatDateTime, formatDuration, formatTime, WEEKDAY_NAMES } from '../../shared/format';
import { ChartBand, ChartBar, ChartHighlight, ChartSeries, TickFormat } from './chart.model';
import { weekdayOf } from '@domain/analytics/weekly-heatmap';

const MARGIN = { left: 40, right: 16 };
const AXIS_HEIGHT = 28;
const PLOT_HEIGHT = 170;
const SECTION_GAP = 16;
const LANE_HEIGHT = 12;
const LANE_GAP = 3;

interface Hover {
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly lines: readonly string[];
}

/**
 * Graphique temporel générique : séries (aires ou lignes), bande
 * d'incertitude, capacité, zones mises en évidence, exécutions sur des lignes.
 */
@Component({
  selector: 'app-time-series-chart',
  templateUrl: './time-series-chart.html',
  styleUrl: './time-series-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeSeriesChart {
  readonly window = input.required<TimeWindow>();
  /** Début du premier créneau des séries et durée d'un créneau. */
  readonly slotStart = input.required<number>();
  readonly slotSize = input.required<number>();
  readonly series = input<readonly ChartSeries[]>([]);
  readonly band = input<ChartBand | null>(null);
  readonly capacity = input(0);
  readonly highlights = input<readonly ChartHighlight[]>([]);
  readonly bars = input<readonly ChartBar[]>([]);
  readonly marker = input<number | null>(null);
  readonly tickFormat = input<TickFormat>('datetime');

  protected readonly margin = MARGIN;
  protected readonly axisHeight = AXIS_HEIGHT;
  protected readonly laneHeight = LANE_HEIGHT;
  protected readonly plotBottom = AXIS_HEIGHT + PLOT_HEIGHT;

  protected readonly width = signal(800);
  protected readonly hover = signal<Hover | null>(null);

  protected readonly plotWidth = computed(() => Math.max(1, this.width() - MARGIN.left - MARGIN.right));
  private readonly lanes = computed(() => packLanes(this.bars()));
  private readonly barsTop = AXIS_HEIGHT + PLOT_HEIGHT + SECTION_GAP;
  protected readonly height = computed(() =>
    this.lanes().length === 0
      ? this.plotBottom + 8
      : this.barsTop + this.lanes().length * (LANE_HEIGHT + LANE_GAP) + 8,
  );

  private readonly yMax = computed(() => {
    const values = [
      ...this.series().flatMap((s) => s.values),
      ...(this.band()?.upper ?? []),
      this.capacity(),
      1,
    ];
    return Math.ceil(Math.max(...values));
  });

  protected readonly yTicks = computed(() => {
    const max = this.yMax();
    const values = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
    return values.map((value) => ({ value, y: this.y(value) }));
  });

  protected readonly xTicks = computed(() =>
    timeTicks(this.window(), Math.max(2, Math.floor(this.plotWidth() / 90)))
      .filter((tick) => tick.time < this.window().end)
      .map((tick) => ({
      ...tick,
      x: this.x(tick.time),
      label:
        this.tickFormat() === 'weekday' && tick.major
          ? WEEKDAY_NAMES[weekdayOf(tick.time)]
          : tick.label,
    })),
  );

  protected readonly paths = computed(() =>
    this.series().map((s) => ({
      label: s.label,
      kind: s.kind,
      tone: s.tone,
      d: this.stepPath(s.values, s.kind === 'area'),
    })),
  );

  protected readonly bandPath = computed(() => {
    const band = this.band();
    if (!band || band.upper.length === 0) return '';
    const top = band.upper.map((v, i) => `L${this.slotX(i)},${this.y(v)}H${this.slotX(i + 1)}`).join('');
    const bottom = [...band.lower]
      .map((v, i) => ({ v, i }))
      .reverse()
      .map(({ v, i }) => `L${this.slotX(i + 1)},${this.y(v)}H${this.slotX(i)}`)
      .join('');
    return `M${this.slotX(0)},${this.y(band.upper[0])}${top}${bottom}Z`;
  });

  protected readonly capacityY = computed(() => (this.capacity() > 0 ? this.y(this.capacity()) : null));

  protected readonly highlightRects = computed(() =>
    this.highlights().map((h) => ({
      key: `${h.tone}-${h.start}`,
      x: this.x(Math.max(h.start, this.window().start)),
      width: Math.max(1, this.x(Math.min(h.end, this.window().end)) - this.x(Math.max(h.start, this.window().start))),
      tone: h.tone,
    })),
  );

  protected readonly barRects = computed(() =>
    this.lanes().flatMap((lane, index) =>
      lane.map((bar) => {
        const x = this.x(Math.max(bar.start, this.window().start));
        return {
          id: bar.id,
          x,
          y: this.barsTop + index * (LANE_HEIGHT + LANE_GAP),
          width: Math.max(2, this.x(Math.min(bar.end, this.window().end)) - x),
          tone: bar.tone,
        };
      }),
    ),
  );

  protected readonly markerX = computed(() => {
    const marker = this.marker();
    return marker === null ? null : this.x(marker);
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected onPointerMove(event: PointerEvent): void {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < MARGIN.left || x > MARGIN.left + this.plotWidth()) {
      this.hover.set(null);
      return;
    }
    this.hover.set(this.describe(x, y));
  }

  protected onPointerLeave(): void {
    this.hover.set(null);
  }

  private x(time: number): number {
    const window = this.window();
    return MARGIN.left + ((time - window.start) / windowDuration(window)) * this.plotWidth();
  }

  private slotX(index: number): number {
    return this.x(this.slotStart() + index * this.slotSize());
  }

  private y(value: number): number {
    return this.plotBottom - (value / this.yMax()) * (PLOT_HEIGHT - 8);
  }

  private stepPath(values: readonly number[], closed: boolean): string {
    if (values.length === 0) return '';
    const steps = values.map((v, i) => `L${this.slotX(i)},${this.y(v)}H${this.slotX(i + 1)}`).join('');
    const first = `M${this.slotX(0)},${closed ? this.plotBottom : this.y(values[0])}`;
    return first + steps + (closed ? `V${this.plotBottom}Z` : '');
  }

  private describe(x: number, y: number): Hover {
    const window = this.window();
    const time = window.start + ((x - MARGIN.left) / this.plotWidth()) * windowDuration(window);

    const lane = Math.floor((y - this.barsTop) / (LANE_HEIGHT + LANE_GAP));
    if (y >= this.barsTop && lane < this.lanes().length) {
      const tolerance = (4 / this.plotWidth()) * windowDuration(window);
      const bar = this.lanes()[lane].find((b) => b.start - tolerance <= time && time <= b.end + tolerance);
      if (bar) {
        return {
          x,
          y,
          title: bar.label,
          lines: [`${this.timeLabel(bar.start)} → ${formatTime(bar.end)}`, formatDuration(bar.end - bar.start)],
        };
      }
    }

    const index = Math.floor((time - this.slotStart()) / this.slotSize());
    const lines = this.series()
      .filter((s) => index >= 0 && index < s.values.length)
      .map((s) => `${s.label} : ${s.values[index].toFixed(1)}`);
    const band = this.band();
    if (band && index >= 0 && index < band.upper.length) {
      lines.push(`${band.label} : ${band.lower[index].toFixed(1)} – ${band.upper[index].toFixed(1)}`);
    }
    if (this.capacity() > 0) lines.push(`Capacité : ${this.capacity()} exécuteurs`);
    return { x, y, title: this.timeLabel(time), lines };
  }

  private timeLabel(time: number): string {
    return this.tickFormat() === 'weekday'
      ? `${WEEKDAY_NAMES[weekdayOf(time)]} ${formatTime(time)}`
      : formatDateTime(time);
  }
}

