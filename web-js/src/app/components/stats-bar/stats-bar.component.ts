import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridStats, LiveMeterReading } from '../../models/grid.models';

@Component({
  selector: 'app-stats-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stats-bar">
      @if (stats()) {
        <!-- Live readings ticker -->
        <div class="ticker">
          <span class="ticker__label text-label">LIVE READINGS</span>
          <div class="ticker__track">
            <div class="ticker__items">
              @for (r of liveReadings(); track r.nodeId) {
                <div class="ticker__item">
                  <span class="ticker__node text-mono">{{ r.nodeName.substring(0, 12) }}</span>
                  <span class="ticker__val text-mono"
                        [class.val--warning]="r.loadPercent > 75"
                        [class.val--critical]="r.loadPercent > 90">
                    {{ r.kva | number:'1.0-0' }} kVA
                  </span>
                  <span class="ticker__pct text-mono text-sm"
                        [class.val--warning]="r.loadPercent > 75"
                        [class.val--critical]="r.loadPercent > 90">
                    {{ r.loadPercent | number:'1.0-0' }}%
                  </span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="stats-sep"></div>

        <!-- KPI pills -->
        <div class="kpi-pills">
          <div class="kpi">
            <span class="kpi__label">NODES</span>
            <span class="kpi__value text-mono">
              {{ tsCount() }} TS · {{ ssCount() }} SS · {{ dtCount() }} DT
            </span>
          </div>
          <div class="kpi">
            <span class="kpi__label">TOTAL CAPACITY</span>
            <span class="kpi__value text-mono">{{ stats()!.totalCapacityKva | number:'1.0-0' }} kVA</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">DATA REFRESH</span>
            <span class="kpi__value text-mono live">
              <span class="live-dot"></span>
              4s interval
            </span>
          </div>
          <div class="kpi">
            <span class="kpi__label">LAST UPDATE</span>
            <span class="kpi__value text-mono">{{ stats()!.timestamp | date:'HH:mm:ss' }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-bar {
      display: flex;
      align-items: center;
      height: 38px;
      padding: 0 14px;
      background: var(--bg-card);
      border-top: 1px solid var(--border-subtle);
      gap: 16px;
      overflow: hidden;
    }

    // Ticker
    .ticker {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;

      &__label { white-space: nowrap; }

      &__track {
        width: 280px;
        overflow: hidden;
        mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
      }

      &__items {
        display: flex;
        gap: 20px;
        animation: ticker-scroll 20s linear infinite;
        width: max-content;
      }

      &__item {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }

      &__node {
        font-size: 10px;
        color: var(--text-muted);
      }

      &__val {
        font-size: 12px;
        color: var(--text-primary);
      }

      &__pct {
        color: var(--text-secondary);
      }
    }

    .val--warning  { color: var(--status-warning) !important; }
    .val--critical { color: var(--status-critical) !important; }

    @keyframes ticker-scroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }

    .stats-sep {
      width: 1px;
      height: 18px;
      background: var(--border-subtle);
      flex-shrink: 0;
    }

    .kpi-pills {
      display: flex;
      align-items: center;
      gap: 20px;
      flex: 1;
    }

    .kpi {
      display: flex;
      align-items: center;
      gap: 6px;

      &__label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: var(--text-muted);
        white-space: nowrap;
      }

      &__value {
        font-size: 11px;
        color: var(--text-secondary);
        white-space: nowrap;

        &.live {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--status-normal);
        }
      }
    }

    .live-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--status-normal);
      animation: pulse-dot 2s ease-in-out infinite;
    }
  `]
})
export class StatsBarComponent {
  stats        = input<GridStats | null>(null);
  liveReadings = input<LiveMeterReading[]>([]);

  tsCount() { return this.liveReadings().filter(r => r.nodeId.startsWith('ts-')).length; }
  ssCount() { return this.liveReadings().filter(r => r.nodeId.startsWith('ss-')).length; }
  dtCount() { return this.liveReadings().filter(r => r.nodeId.startsWith('dt-')).length; }
}
