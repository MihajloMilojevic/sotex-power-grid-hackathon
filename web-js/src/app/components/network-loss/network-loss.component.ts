import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkLoss } from '../../models/grid.models';

@Component({
  selector: 'app-network-loss',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loss-panel">
      <!-- Summary -->
      <div class="loss-summary">
        <div class="summary-stat">
          <span class="summary-stat__value text-mono"
                [class.status-warning]="avgLoss() > 8">
            {{ avgLoss() | number:'1.1-1' }}%
          </span>
          <span class="text-label">Avg Network Loss</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__value text-mono">
            {{ totalLossKwh() | number:'1.0-0' }}
          </span>
          <span class="text-label">Total Loss (kWh/day)</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Feeder list -->
      <div class="loss-list">
        @for (loss of sortedLosses(); track loss.feederId) {
          <div class="loss-row">
            <div class="loss-row__header">
              <span class="loss-row__name text-mono text-sm">{{ loss.feederName }}</span>
              <div class="badge" [class]="voltBadgeClass(loss.voltage)">
                {{ loss.voltage }}kV
              </div>
            </div>
            <div class="loss-row__bar">
              <div class="loss-bar">
                <!-- Input portion -->
                <div class="loss-bar__input" [style.width.%]="100"></div>
                <!-- Loss overlay -->
                <div class="loss-bar__loss"
                     [class.loss-bar__loss--high]="loss.lossPercent > 10"
                     [style.width.%]="loss.lossPercent">
                </div>
              </div>
              <span class="loss-row__percent text-mono"
                    [class.status-critical]="loss.lossPercent > 10"
                    [class.status-warning]="loss.lossPercent > 7 && loss.lossPercent <= 10">
                {{ loss.lossPercent | number:'1.1-1' }}%
              </span>
            </div>
            <div class="loss-row__detail text-sm text-muted">
              In: {{ loss.inputKwh | number:'1.0-0' }} kWh ·
              Out: {{ loss.outputKwh | number:'1.0-0' }} kWh ·
              Loss: {{ loss.lossKwh | number:'1.0-0' }} kWh
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .loss-summary {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .summary-stat {
      flex: 1;
      background: var(--bg-elevated);
      border-radius: 4px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &__value {
        font-size: 20px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1;
      }
    }

    .loss-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .loss-row {
      display: flex;
      flex-direction: column;
      gap: 4px;

      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      &__name { color: var(--text-secondary); }

      &__bar {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      &__percent {
        font-size: 13px;
        font-weight: 700;
        min-width: 42px;
        text-align: right;
        color: var(--status-normal);
      }

      &__detail { line-height: 1; }
    }

    .loss-bar {
      flex: 1;
      height: 6px;
      background: var(--bg-elevated);
      border-radius: 3px;
      position: relative;
      overflow: hidden;

      &__input {
        position: absolute;
        left: 0; top: 0; bottom: 0;
        background: rgba(0, 170, 255, 0.2);
        border-radius: 3px;
      }

      &__loss {
        position: absolute;
        right: 0; top: 0; bottom: 0;
        background: var(--status-normal);
        border-radius: 3px;
        transition: width 0.6s;

        &--high { background: var(--status-critical); }
      }
    }

    .status-warning  { color: var(--status-warning) !important; }
    .status-critical { color: var(--status-critical) !important; }
  `]
})
export class NetworkLossComponent {
  losses = input<NetworkLoss[]>([]);

  sortedLosses() {
    return [...this.losses()].sort((a, b) => b.lossPercent - a.lossPercent);
  }

  avgLoss(): number {
    const l = this.losses();
    if (!l.length) return 0;
    return l.reduce((s, x) => s + x.lossPercent, 0) / l.length;
  }

  totalLossKwh(): number {
    return this.losses().reduce((s, x) => s + x.lossKwh, 0);
  }

  voltBadgeClass(v: number): string {
    return v === 33 ? 'badge--normal' : 'badge--info';
  }
}
