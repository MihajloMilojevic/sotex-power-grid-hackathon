import {
  Component, OnInit, OnDestroy, signal, computed,
  inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { DataRetrievalService } from '../../services/data-retrieval.service';
import {
  GridNode, GridEdge, GridStats, Alarm,
  NetworkLoss, LiveMeterReading
} from '../../models/grid.models';

import { HeaderComponent }       from '../header/header.component';
import { GridTopologyComponent } from '../grid-topology/grid-topology.component';
import { NodeDetailComponent }   from '../node-detail/node-detail.component';
import { AlarmPanelComponent }   from '../alarm-panel/alarm-panel.component';
import { NetworkLossComponent }  from '../network-loss/network-loss.component';
import { StatsBarComponent }     from '../stats-bar/stats-bar.component';

type SideTab = 'detail' | 'alarms' | 'loss';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    GridTopologyComponent,
    NodeDetailComponent,
    AlarmPanelComponent,
    NetworkLossComponent,
    StatsBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">

      <!-- ── Header ──────────────────────────────────────────────── -->
      <app-header [stats]="stats()" />

      <!-- ── Main Content ────────────────────────────────────────── -->
      <div class="dashboard__body">

        <!-- Left: Topology -->
        <div class="topology-panel">
          @if (loading()) {
            <div class="loading-state">
              <div class="loading-spinner"></div>
              <span class="text-muted text-sm">Loading grid topology…</span>
            </div>
          } @else {
            <app-grid-topology
              [nodes]="nodes()"
              [edges]="edges()"
              (nodeSelected)="onNodeSelected($event)" />
          }
        </div>

        <!-- Right: Side Panel -->
        <aside class="side-panel">

          <!-- Tab bar -->
          <div class="tab-bar">
            <button class="tab-btn"
                    [class.tab-btn--active]="activeTab() === 'detail'"
                    (click)="activeTab.set('detail')">
              <span class="tab-btn__icon">◈</span>
              Node Detail
            </button>
            <button class="tab-btn"
                    [class.tab-btn--active]="activeTab() === 'alarms'"
                    (click)="activeTab.set('alarms')">
              <span class="tab-btn__icon">⚠</span>
              Alarms
              @if (unackedAlarmCount() > 0) {
                <span class="alarm-badge"
                      [class.alarm-badge--critical]="criticalAlarmCount() > 0">
                  {{ unackedAlarmCount() }}
                </span>
              }
            </button>
            <button class="tab-btn"
                    [class.tab-btn--active]="activeTab() === 'loss'"
                    (click)="activeTab.set('loss')">
              <span class="tab-btn__icon">⇌</span>
              Net Loss
            </button>
          </div>

          <!-- Tab content -->
          <div class="tab-content">
            @switch (activeTab()) {
              @case ('detail') {
                <div class="scada-card__body">
                  <app-node-detail
                    [node]="selectedNode()"
                    [liveReadings]="liveReadings()" />
                </div>
              }
              @case ('alarms') {
                <div class="scada-card__body">
                  <app-alarm-panel
                    [alarms]="alarms()"
                    (acknowledge)="acknowledgeAlarm($event)" />
                </div>
              }
              @case ('loss') {
                <div class="scada-card__body">
                  <app-network-loss [losses]="networkLoss()" />
                </div>
              }
            }
          </div>

          <!-- Side panel live meter list -->
          <div class="live-meters">
            <div class="live-meters__header">
              <span class="text-label">Live Meters</span>
              <div class="live-chip">
                <span class="live-chip__dot"></span>
                <span>LIVE</span>
              </div>
            </div>
            <div class="live-meters__list">
              @for (reading of liveReadings(); track reading.nodeId) {
                <div class="meter-row"
                     [class.meter-row--selected]="selectedNode()?.id === reading.nodeId"
                     (click)="selectNodeById(reading.nodeId)">
                  <div class="meter-row__left">
                    <span class="meter-row__type-badge"
                          [class]="'type-badge--' + reading.nodeId.split('-')[0]">
                      {{ reading.nodeId.split('-')[0].toUpperCase() }}
                    </span>
                    <span class="meter-row__name">{{ reading.nodeName }}</span>
                  </div>
                  <div class="meter-row__right">
                    <span class="meter-row__kva text-mono"
                          [class.val--warning]="reading.loadPercent > 75"
                          [class.val--critical]="reading.loadPercent > 90">
                      {{ reading.kva | number:'1.0-0' }}
                    </span>
                    <div class="meter-mini-bar">
                      <div class="meter-mini-bar__fill"
                           [class.fill--warning]="reading.loadPercent > 75"
                           [class.fill--critical]="reading.loadPercent > 90"
                           [style.width.%]="reading.loadPercent">
                      </div>
                    </div>
                    <span class="meter-row__pct text-mono text-xs"
                          [class.val--warning]="reading.loadPercent > 75"
                          [class.val--critical]="reading.loadPercent > 90">
                      {{ reading.loadPercent | number:'1.0-0' }}%
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        </aside>
      </div>

      <!-- ── Stats Bar ────────────────────────────────────────────── -->
      <app-stats-bar [stats]="stats()" [liveReadings]="liveReadings()" />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-primary);
    }

    .dashboard {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .dashboard__body {
      display: flex;
      flex: 1;
      overflow: hidden;
      gap: 0;
    }

    // ── Topology panel ──────────────────────────────────────────────
    .topology-panel {
      flex: 1;
      overflow: hidden;
      border-right: 1px solid var(--border-subtle);
      position: relative;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 14px;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 2px solid var(--border-subtle);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    // ── Side Panel ──────────────────────────────────────────────────
    .side-panel {
      width: 320px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-card);
    }

    // Tab bar
    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
      background: var(--bg-primary);
    }

    .tab-btn {
      flex: 1;
      padding: 10px 4px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-family: var(--font-ui);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: color 0.15s, border-color 0.15s;
      position: relative;

      &:hover { color: var(--text-secondary); }

      &--active {
        color: var(--accent-blue);
        border-bottom-color: var(--accent-blue);
      }

      &__icon { font-size: 12px; }
    }

    .alarm-badge {
      min-width: 16px;
      height: 16px;
      background: var(--status-warning-dim);
      border: 1px solid var(--status-warning);
      border-radius: 8px;
      font-size: 9px;
      font-weight: 700;
      color: var(--status-warning);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;

      &--critical {
        background: var(--status-critical-dim);
        border-color: var(--status-critical);
        color: var(--status-critical);
        animation: pulse-dot 1.5s ease-in-out infinite;
      }
    }

    // Tab content
    .tab-content {
      flex: 1;
      overflow-y: auto;
      min-height: 0;

      .scada-card__body {
        padding: 12px;
      }
    }

    // Live meters strip
    .live-meters {
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-primary);
      flex-shrink: 0;
      max-height: 220px;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-subtle);
        flex-shrink: 0;
      }

      &__list {
        overflow-y: auto;
        flex: 1;
      }
    }

    .live-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--status-normal);

      &__dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--status-normal);
        animation: pulse-dot 2s ease-in-out infinite;
      }
    }

    // Meter rows
    .meter-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-subtle);
      transition: background 0.15s;

      &:hover { background: var(--bg-card-hover); }

      &--selected { background: var(--accent-blue-dim); }

      &__left {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        flex: 1;
      }

      &__name {
        font-size: 11px;
        color: var(--text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 130px;
      }

      &__right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      &__kva {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-primary);
        min-width: 44px;
        text-align: right;
      }

      &__pct {
        min-width: 30px;
        text-align: right;
        color: var(--text-secondary);
      }
    }

    .type-badge--ts { color: #ff5252; }
    .type-badge--ss { color: #1de9b6; }
    .type-badge--dt { color: #448aff; }
    [class*="type-badge"] {
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .meter-mini-bar {
      width: 40px;
      height: 3px;
      background: var(--bg-elevated);
      border-radius: 2px;
      overflow: hidden;
    }

    .meter-mini-bar__fill {
      height: 100%;
      background: var(--status-normal);
      border-radius: 2px;
      transition: width 0.6s;

      &.fill--warning  { background: var(--status-warning); }
      &.fill--critical { background: var(--status-critical); }
    }

    .val--warning  { color: var(--status-warning) !important; }
    .val--critical { color: var(--status-critical) !important; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly svc = inject(DataRetrievalService);
  private readonly destroy$ = new Subject<void>();

  // ── State signals ─────────────────────────────────────────────────
  loading      = signal(true);
  nodes        = signal<GridNode[]>([]);
  edges        = signal<GridEdge[]>([]);
  stats        = signal<GridStats | null>(null);
  alarms       = signal<Alarm[]>([]);
  networkLoss  = signal<NetworkLoss[]>([]);
  liveReadings = signal<LiveMeterReading[]>([]);
  selectedNode = signal<GridNode | null>(null);
  activeTab    = signal<SideTab>('detail');

  // ── Computed ──────────────────────────────────────────────────────
  unackedAlarmCount  = computed(() => this.alarms().filter(a => !a.acknowledged).length);
  criticalAlarmCount = computed(() => this.alarms().filter(a => a.severity === 'critical' && !a.acknowledged).length);

  ngOnInit(): void {
    // Load static data in parallel
    forkJoin({
      topology:    this.svc.getGridTopology(),
      stats:       this.svc.getGridStats(),
      alarms:      this.svc.getAlarms(),
      networkLoss: this.svc.getNetworkLoss(),
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe(({ topology, stats, alarms, networkLoss }) => {
      this.nodes.set(topology.nodes);
      this.edges.set(topology.edges);
      this.stats.set(stats);
      this.alarms.set(alarms);
      this.networkLoss.set(networkLoss);
      this.loading.set(false);
    });

    // Live polling — every 4 seconds
    this.svc.getLiveMeterReadings(4000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(readings => {
        this.liveReadings.set(readings);
        // Update node load values from live readings
        this.nodes.update(nodes =>
          nodes.map(node => {
            const r = readings.find(x => x.nodeId === node.id);
            if (!r) return node;
            return {
              ...node,
              currentKva:  r.kva,
              loadPercent: r.loadPercent,
              status: r.loadPercent >= 90 ? 'critical'
                    : r.loadPercent >= 75 ? 'warning'
                    : 'normal',
            };
          })
        );
        // Refresh stats
        this.svc.getGridStats().pipe(takeUntil(this.destroy$)).subscribe(s => this.stats.set(s));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Event Handlers ────────────────────────────────────────────────

  onNodeSelected(node: GridNode | null): void {
    this.selectedNode.set(node);
    if (node) this.activeTab.set('detail');
  }

  selectNodeById(nodeId: string): void {
    const node = this.nodes().find(n => n.id === nodeId) ?? null;
    this.selectedNode.set(node);
    if (node) this.activeTab.set('detail');
  }

  acknowledgeAlarm(alarmId: string): void {
    this.alarms.update(alarms =>
      alarms.map(a => a.id === alarmId ? { ...a, acknowledged: true } : a)
    );
  }
}
