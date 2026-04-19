import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridNode, LiveMeterReading } from '../../models/grid.models';

@Component({
  selector: 'app-node-detail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node()) {
      <div class="detail-panel" @fadeIn>
        <!-- Node Header -->
        <div class="detail-header">
          <div class="node-icon" [class]="'node-icon--' + node()!.type">
            <svg width="28" height="28" viewBox="-14 -14 28 28">
              @switch (node()!.type) {
                @case ('ts') {
                  <polygon [attr.points]="hexPts(13)"
                           [attr.fill]="typeFill(node()!.type)"
                           [attr.stroke]="typeStroke(node()!.type)"
                           stroke-width="1.5"/>
                }
                @case ('ss') {
                  <polygon points="0,-12 12,0 0,12 -12,0"
                           [attr.fill]="typeFill(node()!.type)"
                           [attr.stroke]="typeStroke(node()!.type)"
                           stroke-width="1.5"/>
                }
                @case ('dt') {
                  <rect x="-12" y="-10" width="24" height="20" rx="3"
                        [attr.fill]="typeFill(node()!.type)"
                        [attr.stroke]="typeStroke(node()!.type)"
                        stroke-width="1.5"/>
                }
              }
            </svg>
          </div>
          <div class="detail-title">
            <span class="detail-type">{{ typeLabel(node()!.type) }}</span>
            <span class="detail-name">{{ node()!.name }}</span>
          </div>
          <div class="badge" [class]="'badge--' + node()!.status">
            <div class="badge__dot" [class.badge__dot--pulse]="node()!.status !== 'normal'"></div>
            {{ node()!.status | uppercase }}
          </div>
        </div>

        <!-- Load Gauge -->
        <div class="load-gauge">
          <div class="load-gauge__header">
            <span class="text-label">Load</span>
            <span class="load-gauge__value text-mono"
                  [class.status-warning]="node()!.loadPercent > 75"
                  [class.status-critical]="node()!.loadPercent > 90">
              {{ node()!.loadPercent | number:'1.1-1' }}%
            </span>
          </div>
          <div class="load-bar">
            <div class="load-bar__fill"
                 [class.load-bar__fill--warning]="node()!.loadPercent > 75"
                 [class.load-bar__fill--critical]="node()!.loadPercent > 90"
                 [class.load-bar__fill--normal]="node()!.loadPercent <= 75"
                 [style.width.%]="node()!.loadPercent">
            </div>
          </div>
          <div class="load-gauge__detail text-sm text-muted">
            {{ node()!.currentKva | number:'1.0-0' }} kVA / {{ node()!.nameplateRating | number:'1.0-0' }} kVA nameplate
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="metrics-grid">
          <div class="metric-cell">
            <span class="metric-cell__label">Current Load</span>
            <span class="metric-cell__value text-mono">{{ node()!.currentKva | number:'1.0-0' }}</span>
            <span class="metric-cell__unit">kVA</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell__label">Nameplate</span>
            <span class="metric-cell__value text-mono">{{ node()!.nameplateRating | number:'1.0-0' }}</span>
            <span class="metric-cell__unit">kVA</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell__label">Meter ID</span>
            <span class="metric-cell__value text-mono">{{ node()!.meterId }}</span>
            <span class="metric-cell__unit">—</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell__label">Node ID</span>
            <span class="metric-cell__value text-mono">{{ node()!.id }}</span>
            <span class="metric-cell__unit">—</span>
          </div>
        </div>

        <!-- Live Reading from this node -->
        @if (liveReading()) {
          <div class="divider"></div>
          <div class="live-reading">
            <div class="live-reading__header">
              <span class="text-label">Live Reading</span>
              <div class="live-indicator">
                <span class="live-dot"></span>
                <span class="text-xs text-muted">LIVE</span>
              </div>
            </div>
            <div class="reading-row">
              <span class="text-muted text-sm">Active Power</span>
              <span class="text-mono">{{ liveReading()!.kva * 0.85 | number:'1.0-0' }} kW</span>
            </div>
            <div class="reading-row">
              <span class="text-muted text-sm">Apparent Power</span>
              <span class="text-mono">{{ liveReading()!.kva | number:'1.0-0' }} kVA</span>
            </div>
            <div class="reading-row">
              <span class="text-muted text-sm">Power Factor</span>
              <span class="text-mono">0.85</span>
            </div>
            <div class="reading-row">
              <span class="text-muted text-sm">Last Updated</span>
              <span class="text-mono text-xs">{{ liveReading()!.timestamp | date:'HH:mm:ss' }}</span>
            </div>
          </div>
        }

        <!-- Location -->
        @if (node()!.latitude) {
          <div class="divider"></div>
          <div class="location-row">
            <span class="text-label">Location</span>
            <span class="text-mono text-sm">
              {{ node()!.latitude | number:'1.4-4' }}°N, {{ node()!.longitude | number:'1.4-4' }}°E
            </span>
          </div>
        }
      </div>
    } @else {
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 40 40" opacity="0.3">
          <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="1"/>
          <line x1="20" y1="10" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <circle cx="20" cy="26" r="2" fill="currentColor"/>
        </svg>
        <p>Select a node in the topology view to inspect details.</p>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .detail-panel {
      animation: fade-in 0.2s ease;
    }

    // Header
    .detail-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .node-icon {
      width: 36px;
      height: 36px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &--ts { background: rgba(183, 28, 28, 0.15); }
      &--ss { background: rgba(0, 77, 64, 0.2); }
      &--dt { background: rgba(13, 71, 161, 0.2); }
    }

    .detail-title {
      flex: 1;
      overflow: hidden;

      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .detail-type {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .detail-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    // Load gauge
    .load-gauge {
      background: var(--bg-elevated);
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 12px;

      &__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      &__value {
        font-size: 18px;
        font-weight: 700;
        color: var(--status-normal);
      }

      &__detail {
        margin-top: 6px;
        text-align: right;
      }
    }

    // Metrics grid
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }

    .metric-cell {
      background: var(--bg-elevated);
      border-radius: 4px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &__label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
      }

      &__value {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        line-height: 1;
      }

      &__unit {
        font-size: 10px;
        color: var(--text-secondary);
      }
    }

    // Live reading
    .live-reading {
      &__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--status-normal);
      animation: pulse-dot 1.5s ease-in-out infinite;
    }

    .reading-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid var(--border-subtle);

      &:last-child { border-bottom: none; }
    }

    // Location
    .location-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    // Empty state
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 20px;
      color: var(--text-muted);
      text-align: center;

      p { font-size: 12px; line-height: 1.6; }
    }
  `]
})
export class NodeDetailComponent {
  node         = input<GridNode | null>(null);
  liveReadings = input<LiveMeterReading[]>([]);

  liveReading() {
    const n = this.node();
    if (!n) return null;
    return this.liveReadings().find(r => r.nodeId === n.id) ?? null;
  }

  hexPts(r: number): string {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${r * Math.cos(a)},${r * Math.sin(a)}`;
    }).join(' ');
  }

  typeFill(type: string): string {
    return { ts: '#b71c1c22', ss: '#004d4022', dt: '#0d47a122' }[type] ?? '#00000022';
  }

  typeStroke(type: string): string {
    return { ts: '#ff5252', ss: '#1de9b6', dt: '#448aff' }[type] ?? '#888';
  }

  typeLabel(type: string): string {
    return { ts: 'Transmission Station', ss: 'Injection Substation', dt: 'Distribution Transformer' }[type] ?? type;
  }
}
