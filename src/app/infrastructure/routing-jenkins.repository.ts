import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { TimeWindow } from '@domain/time-window';
import { JenkinsJob } from '@domain/job';
import {
  ConnectionReport,
  JenkinsRepository,
  ScheduleFetchEvent,
  WorkloadFetchEvent,
} from '@ports/jenkins.repository';
import { DemoJenkinsRepository } from './demo/demo-jenkins.repository';
import { HttpJenkinsRepository } from './jenkins/http-jenkins.repository';

/** Aiguille vers la vraie API ou la démo selon la source choisie dans les paramètres. */
@Injectable()
export class RoutingJenkinsRepository extends JenkinsRepository {
  private readonly http = inject(HttpJenkinsRepository);
  private readonly demo = inject(DemoJenkinsRepository);

  checkConnection(settings: JenkinsSettings): Observable<ConnectionReport> {
    return this.sourceFor(settings).checkConnection(settings);
  }

  fetchWorkload(settings: JenkinsSettings, window: TimeWindow): Observable<WorkloadFetchEvent> {
    return this.sourceFor(settings).fetchWorkload(settings, window);
  }

  fetchSchedules(settings: JenkinsSettings, jobs: readonly JenkinsJob[]): Observable<ScheduleFetchEvent> {
    return this.sourceFor(settings).fetchSchedules(settings, jobs);
  }

  private sourceFor(settings: JenkinsSettings): JenkinsRepository {
    return settings.dataSource === 'demo' ? this.demo : this.http;
  }
}
