import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridStats } from '../../models/grid.models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <!-- Left: Branding -->
      <div class="header__brand">
        <div class="header__logo">
          <div class="logo-mark">
            <span class="logo-mark__bar"></span>
            <span class="logo-mark__bar"></span>
            <span class="logo-mark__bar"></span>
          </div>
          <div class="logo-text">
            <span class="logo-text__company">SOTEX</span>
            <span class="logo-text__system">POWER GRID SCADA</span>
          </div>
        </div>
        <div class="header__system-id">
          <span class="text-label">System ID</span>
          <span class="text-mono">NG-LAG-GRID-001</span>
        </div>
      </div>

      <!-- Center: Key metrics -->
      <div class="header__metrics">
        @if (stats()) {
          <div class="metric">
            <span class="metric__label">Total Load</span>
            <span class="metric__value text-mono">{{ stats()!.totalLoadKva | number:'1.0-0' }} <em>kVA</em></span>
          </div>
          <div class="metric-sep"></div>
          <div class="metric">
            <span class="metric__label">System Load</span>
            <span class="metric__value text-mono" [class.text-warning]="stats()!.loadPercent > 75" [class.text-critical]="stats()!.loadPercent > 90">
              {{ stats()!.loadPercent | number:'1.1-1' }}<em>%</em>
            </span>
          </div>
          <div class="metric-sep"></div>
          <div class="metric">
            <span class="metric__label">Net Loss</span>
            <span class="metric__value text-mono" [class.text-warning]="stats()!.networkLossPercent > 8">
              {{ stats()!.networkLossPercent | number:'1.1-1' }}<em>%</em>
            </span>
          </div>
          <div class="metric-sep"></div>
          <div class="metric">
            <span class="metric__label">Active Alarms</span>
            <span class="metric__value text-mono" [class.text-critical]="stats()!.criticalAlarms > 0" [class.text-warning]="stats()!.activeAlarms > 0 && stats()!.criticalAlarms === 0">
              {{ stats()!.activeAlarms }}
            </span>
          </div>
        }
      </div>

      <!-- Right: Status + Clock -->
      <div class="header__right">
        <div class="system-status" [class.system-status--ok]="systemOnline">
          <div class="status-indicator"></div>
          <span>{{ systemOnline ? 'SYSTEM ONLINE' : 'SYSTEM FAULT' }}</span>
        </div>
        <div class="clock text-mono">{{ currentTime | date:'HH:mm:ss' }}</div>
        <div class="date text-muted text-sm">{{ currentTime | date:'dd MMM yyyy' }}</div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 16px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-default);
      position: relative;
      z-index: 100;
      gap: 16px;

      &::before {
        content: '';
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg,
          transparent 0%,
          var(--accent-blue) 20%,
          var(--accent-blue) 80%,
          transparent 100%
        );
        opacity: 0.4;
      }
    }

    // Brand
    .header__brand {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }

    .header__logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-mark {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 18px;

      &__bar {
        display: block;
        height: 2px;
        background: var(--accent-blue);
        border-radius: 1px;

        &:nth-child(1) { width: 100%; }
        &:nth-child(2) { width: 70%; }
        &:nth-child(3) { width: 100%; }
      }
    }

    .logo-text {
      display: flex;
      flex-direction: column;
      line-height: 1;

      &__company {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: var(--accent-blue);
      }

      &__system {
        font-size: 9px;
        letter-spacing: 0.2em;
        color: var(--text-secondary);
        margin-top: 2px;
      }
    }

    .header__system-id {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 16px;
      border-left: 1px solid var(--border-subtle);

      .text-label { font-size: 9px; }
      .text-mono  { font-size: 12px; color: var(--text-secondary); }
    }

    // Metrics
    .header__metrics {
      display: flex;
      align-items: center;
      gap: 0;
      background: var(--bg-primary);
      border: 1px solid var(--border-subtle);
      border-radius: 3px;
      padding: 0 4px;
    }

    .metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 20px;

      &__label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
        margin-bottom: 2px;
      }

      &__value {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);

        em { font-size: 11px; font-style: normal; color: var(--text-secondary); margin-left: 2px; }
      }
    }

    .metric-sep {
      width: 1px;
      height: 28px;
      background: var(--border-subtle);
    }

    .text-warning  { color: var(--status-warning) !important; }
    .text-critical { color: var(--status-critical) !important; }

    // Right
    .header__right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
    }

    .system-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: var(--status-offline);

      &--ok {
        color: var(--status-normal);

        .status-indicator {
          background: var(--status-normal);
          box-shadow: 0 0 6px var(--status-normal);
          animation: pulse-dot 2s ease-in-out infinite;
        }
      }
    }

    .status-indicator {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--status-offline);
    }

    .clock {
      font-size: 20px;
      letter-spacing: 0.05em;
      color: var(--text-primary);
      line-height: 1;
    }

    .date {
      font-size: 10px;
      text-align: right;
    }
  `]
})
export class HeaderComponent {
  stats = input<GridStats | null>(null);
  systemOnline = true;
  currentTime = new Date();

  constructor() {
    setInterval(() => { this.currentTime = new Date(); }, 1000);
  }
}
