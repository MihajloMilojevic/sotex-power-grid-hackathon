import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Alarm } from '../../models/grid.models';

@Component({
  selector: 'app-alarm-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alarm-panel">
      <div class="alarm-summary">
        <div class="alarm-count alarm-count--critical">
          <span class="alarm-count__number">{{ criticalCount() }}</span>
          <span class="alarm-count__label">Critical</span>
        </div>
        <div class="alarm-count alarm-count--warning">
          <span class="alarm-count__number">{{ warningCount() }}</span>
          <span class="alarm-count__label">Warning</span>
        </div>
        <div class="alarm-count alarm-count--info">
          <span class="alarm-count__number">{{ infoCount() }}</span>
          <span class="alarm-count__label">Info</span>
        </div>
      </div>

      <div class="alarm-list">
        @for (alarm of alarms(); track alarm.id) {
          <div class="alarm-item"
               [class.alarm-item--critical]="alarm.severity === 'critical'"
               [class.alarm-item--warning]="alarm.severity === 'warning'"
               [class.alarm-item--info]="alarm.severity === 'info'"
               [class.alarm-item--acked]="alarm.acknowledged">
            <div class="alarm-item__indicator"></div>
            <div class="alarm-item__body">
              <div class="alarm-item__header">
                <span class="alarm-item__node">{{ alarm.nodeName }}</span>
                <span class="alarm-item__time text-mono text-xs">
                  {{ alarm.timestamp | date:'HH:mm' }}
                </span>
              </div>
              <span class="alarm-item__message">{{ alarm.message }}</span>
              <div class="alarm-item__footer">
                <span class="badge" [class]="'badge--' + alarm.severity">
                  {{ alarm.severity | uppercase }}
                </span>
                @if (alarm.acknowledged) {
                  <span class="acked-label">✓ Acknowledged</span>
                } @else {
                  <button class="ack-btn" (click)="acknowledge.emit(alarm.id)">
                    Acknowledge
                  </button>
                }
              </div>
            </div>
          </div>
        } @empty {
          <div class="no-alarms">
            <span>✓</span>
            <p>No active alarms</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .alarm-summary {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    .alarm-count {
      flex: 1;
      background: var(--bg-elevated);
      border-radius: 4px;
      padding: 8px;
      text-align: center;
      border-top: 2px solid transparent;

      &--critical {
        border-color: var(--status-critical);
        background: var(--status-critical-dim);
      }
      &--warning {
        border-color: var(--status-warning);
        background: var(--status-warning-dim);
      }
      &--info {
        border-color: var(--accent-blue);
        background: var(--accent-blue-dim);
      }

      &__number {
        display: block;
        font-family: var(--font-mono);
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
      }
      &__label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-secondary);
        margin-top: 2px;
        display: block;
      }
    }

    .alarm-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .alarm-item {
      display: flex;
      gap: 8px;
      background: var(--bg-elevated);
      border-radius: 4px;
      padding: 10px 10px 10px 0;
      overflow: hidden;
      transition: opacity 0.2s;

      &--acked { opacity: 0.5; }

      &__indicator {
        width: 3px;
        flex-shrink: 0;
        border-radius: 0 2px 2px 0;
      }

      &--critical .alarm-item__indicator { background: var(--status-critical); }
      &--warning  .alarm-item__indicator { background: var(--status-warning);  }
      &--info     .alarm-item__indicator { background: var(--accent-blue);     }

      &__body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      &__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      &__node {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__time { color: var(--text-muted); }

      &__message {
        font-size: 11px;
        color: var(--text-secondary);
        line-height: 1.4;
      }

      &__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 2px;
      }
    }

    .acked-label {
      font-size: 10px;
      color: var(--status-normal);
    }

    .ack-btn {
      font-size: 10px;
      background: none;
      border: 1px solid var(--border-default);
      border-radius: 2px;
      padding: 2px 8px;
      color: var(--text-secondary);
      cursor: pointer;
      letter-spacing: 0.04em;

      &:hover {
        border-color: var(--accent-blue);
        color: var(--accent-blue);
      }
    }

    .no-alarms {
      padding: 32px;
      text-align: center;
      color: var(--status-normal);
      opacity: 0.6;

      span { font-size: 24px; display: block; margin-bottom: 8px; }
      p    { font-size: 12px; color: var(--text-muted); }
    }
  `]
})
export class AlarmPanelComponent {
  alarms      = input<Alarm[]>([]);
  acknowledge = output<string>();

  criticalCount() { return this.alarms().filter(a => a.severity === 'critical' && !a.acknowledged).length; }
  warningCount()  { return this.alarms().filter(a => a.severity === 'warning'  && !a.acknowledged).length; }
  infoCount()     { return this.alarms().filter(a => a.severity === 'info'     && !a.acknowledged).length; }
}
