import { Pipe, PipeTransform } from '@angular/core';
import { formatDateTime, formatDuration, formatPercent } from './format';

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number): string {
    return formatDuration(ms);
  }
}

@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  transform(ms: number): string {
    return formatDateTime(ms);
  }
}

@Pipe({ name: 'ratio' })
export class RatioPipe implements PipeTransform {
  transform(ratio: number | null, digits = 0): string {
    return formatPercent(ratio, digits);
  }
}
