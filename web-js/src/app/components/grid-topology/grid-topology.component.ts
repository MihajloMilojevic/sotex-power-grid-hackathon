import {
  Component, input, output, signal, computed,
  ChangeDetectionStrategy, ElementRef, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridNode, GridEdge, NodeType, NodeStatus } from '../../models/grid.models';

interface Transform { x: number; y: number; scale: number; }

@Component({
  selector: 'app-grid-topology',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="topology-container">
      <!-- Toolbar -->
      <div class="toolbar">
        <span class="toolbar__title">GRID TOPOLOGY</span>
        <div class="toolbar__controls">
          <!-- Legend -->
          <div class="legend">
            <div class="legend-item">
              <svg width="14" height="14" viewBox="-7 -7 14 14">
                <polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="#ff5252" stroke="#ff1744" stroke-width="1"/>
              </svg>
              <span>Transmission Station (TS)</span>
            </div>
            <div class="legend-item">
              <svg width="14" height="14" viewBox="-7 -7 14 14">
                <circle r="5.5" fill="#1de9b6" stroke="#00bfa5" stroke-width="1"/>
              </svg>
              <span>Injection Substation (SS)</span>
            </div>
            <div class="legend-item">
              <svg width="14" height="14" viewBox="-7 -7 14 14">
                <rect x="-5.5" y="-5.5" width="11" height="11" rx="2" fill="#448aff" stroke="#2979ff" stroke-width="1"/>
              </svg>
              <span>Distribution Transformer (DT)</span>
            </div>
            <div class="legend-sep"></div>
            <div class="legend-item">
              <svg width="24" height="3" viewBox="0 0 24 3">
                <line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#00e676" stroke-width="2"/>
              </svg>
              <span>33kV Feeder</span>
            </div>
            <div class="legend-item">
              <svg width="24" height="3" viewBox="0 0 24 3">
                <line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#00aaff" stroke-width="1.5" stroke-dasharray="4 3"/>
              </svg>
              <span>11kV Feeder</span>
            </div>
          </div>
          <!-- Zoom controls -->
          <div class="zoom-controls">
            <button class="zoom-btn" (click)="zoom(0.15)" title="Zoom in">+</button>
            <span class="zoom-level text-mono">{{ (transform().scale * 100) | number:'1.0-0' }}%</span>
            <button class="zoom-btn" (click)="zoom(-0.15)" title="Zoom out">−</button>
            <button class="zoom-btn zoom-btn--reset" (click)="resetTransform()" title="Reset view">⟳</button>
          </div>
        </div>
      </div>

      <!-- SVG Canvas -->
      <svg #svgCanvas class="topology-svg"
           [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH"
           (mousedown)="onMouseDown($event)"
           (mousemove)="onMouseMove($event)"
           (mouseup)="onMouseUp($event)"
           (mouseleave)="onMouseUp($event)"
           (wheel)="onWheel($event)">

        <defs>
          <!-- Arrow markers per voltage -->
          <marker id="arrow-33" viewBox="0 0 10 10" refX="8" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 2L8 5L2 8" fill="none" stroke="#00e676" stroke-width="1.5" stroke-linecap="round"/>
          </marker>
          <marker id="arrow-11" viewBox="0 0 10 10" refX="8" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 2L8 5L2 8" fill="none" stroke="#00aaff" stroke-width="1.5" stroke-linecap="round"/>
          </marker>
          <!-- Glow filters -->
          <filter id="glow-critical" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-warning" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- Grid pattern -->
          <pattern id="grid-dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="0.8" fill="rgba(0,170,255,0.12)"/>
          </pattern>
        </defs>

        <!-- Background -->
        <rect [attr.width]="svgW" [attr.height]="svgH" fill="url(#grid-dots)"/>

        <!-- Tier labels (fixed, outside transform group) -->
        <text x="16" y="92" class="tier-label">TRANSMISSION</text>
        <text x="16" y="302" class="tier-label">33kV INJECTION</text>
        <text x="16" y="522" class="tier-label">11kV DISTRIBUTION</text>

        <!-- Tier dividers -->
        <line x1="0" [attr.y1]="140" [attr.x2]="svgW" [attr.y2]="140"
              stroke="rgba(0,170,255,0.06)" stroke-width="1"/>
        <line x1="0" [attr.y1]="400" [attr.x2]="svgW" [attr.y2]="400"
              stroke="rgba(0,170,255,0.06)" stroke-width="1"/>

        <!-- Main pannable/zoomable group -->
        <g [attr.transform]="transformString()">

          <!-- ── EDGES ── -->
          @for (edge of edges(); track edge.id) {
            @let src = nodeMap()[edge.sourceId];
            @let tgt = nodeMap()[edge.targetId];
            @if (src && tgt) {
              <g class="edge" [class.edge--selected]="isEdgeRelatedToSelected(edge)">
                <!-- Shadow/glow for high-load edges -->
                @if (edge.loadPercent > 75) {
                  <line
                    [attr.x1]="src.x" [attr.y1]="src.y"
                    [attr.x2]="tgt.x" [attr.y2]="tgt.y"
                    [attr.stroke]="edge.voltage === 33 ? 'rgba(0,230,118,0.2)' : 'rgba(0,170,255,0.2)'"
                    stroke-width="6"/>
                }
                <!-- Main edge line -->
                <line
                  [attr.x1]="src.x" [attr.y1]="src.y"
                  [attr.x2]="tgt.x" [attr.y2]="tgt.y"
                  [attr.stroke]="edge.voltage === 33 ? '#00e676' : '#00aaff'"
                  [attr.stroke-width]="edge.voltage === 33 ? 2 : 1.5"
                  [attr.stroke-dasharray]="edge.voltage === 11 ? '6 3' : 'none'"
                  [attr.marker-end]="edge.voltage === 33 ? 'url(#arrow-33)' : 'url(#arrow-11)'"
                  stroke-linecap="round"
                  [attr.opacity]="isEdgeRelatedToSelected(edge) ? 1 : 0.65"/>

                <!-- Edge load label -->
                @if (showEdgeLabels()) {
                  <text
                    [attr.x]="(src.x + tgt.x) / 2 + 6"
                    [attr.y]="(src.y + tgt.y) / 2 - 6"
                    class="edge-label"
                    [attr.fill]="edge.loadPercent > 85 ? '#ff5252' : edge.loadPercent > 70 ? '#ffab00' : '#00e676'">
                    {{ edge.loadPercent | number:'1.0-0' }}%
                  </text>
                }
              </g>
            }
          }

          <!-- ── NODES ── -->
          @for (node of nodes(); track node.id) {
            <g class="node"
               [class.node--selected]="selectedNodeId() === node.id"
               [class.node--critical]="node.status === 'critical'"
               [class.node--warning]="node.status === 'warning'"
               [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
               (click)="onNodeClick(node)"
               (mouseenter)="hoveredNodeId.set(node.id)"
               (mouseleave)="hoveredNodeId.set(null)"
               style="cursor: pointer">

              <!-- Selection ring -->
              @if (selectedNodeId() === node.id) {
                <circle [attr.r]="getNodeRadius(node.type) + 12"
                        fill="none" stroke="white" stroke-width="1.5"
                        stroke-dasharray="4 3" opacity="0.8"
                        [attr.filter]="'url(#glow-selected)'">
                  <animateTransform attributeName="transform" type="rotate"
                    from="0" to="360" dur="8s" repeatCount="indefinite"/>
                </circle>
              }

              <!-- Status glow ring -->
              @if (node.status !== 'normal') {
                <circle [attr.r]="getNodeRadius(node.type) + 8"
                        fill="none"
                        [attr.stroke]="getStatusColor(node.status)"
                        stroke-width="1" opacity="0.4"
                        [attr.filter]="node.status === 'critical' ? 'url(#glow-critical)' : 'url(#glow-warning)'"/>
              }

              <!-- Node Shape -->
              @switch (node.type) {
                @case ('ts') {
                  <!-- Transmission Station: hexagon -->
                  <polygon [attr.points]="hexPoints(40)"
                           [attr.fill]="getNodeFill(node)"
                           [attr.stroke]="getNodeStroke(node)"
                           stroke-width="1.5"
                           [attr.filter]="node.status !== 'normal' ? 'url(#glow-' + node.status + ')' : ''"/>
                }
                @case ('ss') {
                  <!-- Injection Substation: diamond -->
                  <polygon [attr.points]="diamondPoints(34)"
                           [attr.fill]="getNodeFill(node)"
                           [attr.stroke]="getNodeStroke(node)"
                           stroke-width="1.5"
                           [attr.filter]="node.status !== 'normal' ? 'url(#glow-' + node.status + ')' : ''"/>
                }
                @case ('dt') {
                  <!-- Distribution Transformer: rounded rect -->
                  <rect x="-32" y="-24" width="64" height="48" rx="6"
                        [attr.fill]="getNodeFill(node)"
                        [attr.stroke]="getNodeStroke(node)"
                        stroke-width="1.5"
                        [attr.filter]="node.status !== 'normal' ? 'url(#glow-' + node.status + ')' : ''"/>
                }
              }

              <!-- Load arc -->
              <circle [attr.r]="getNodeRadius(node.type) + 3"
                      fill="none"
                      [attr.stroke]="getLoadColor(node.loadPercent)"
                      stroke-width="3"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="getLoadArc(node.loadPercent, getNodeRadius(node.type) + 3)"
                      [attr.transform]="'rotate(-90)'"
                      opacity="0.8"/>

              <!-- Type badge -->
              <text y="-14" class="node-type-badge"
                    [attr.fill]="getNodeStroke(node)">
                {{ node.type.toUpperCase() }}
              </text>

              <!-- Node name -->
              <text y="6" class="node-name">{{ getShortName(node.name) }}</text>

              <!-- Load % -->
              <text y="19" class="node-load"
                    [attr.fill]="getLoadColor(node.loadPercent)">
                {{ node.loadPercent | number:'1.0-0' }}%
              </text>

              <!-- Meter dot -->
              <circle cx="22" cy="-22" r="4"
                      fill="#ffd740" stroke="#ffa000" stroke-width="0.5"
                      opacity="0.9"/>

              <!-- Critical pulse animation -->
              @if (node.status === 'critical') {
                <circle [attr.r]="getNodeRadius(node.type) + 4"
                        fill="none" stroke="#ff1744" stroke-width="1"
                        opacity="0">
                  <animate attributeName="r"
                    [attr.values]="(getNodeRadius(node.type) + 4) + ';' + (getNodeRadius(node.type) + 20)"
                    dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="opacity"
                    values="0.6;0" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              }
            </g>
          }
        </g>

        <!-- Hover tooltip -->
        @if (hoveredNode()) {
          <g class="tooltip"
             [attr.transform]="getTooltipPos(hoveredNode()!)">
            <rect x="0" y="0" width="180" height="72" rx="4"
                  fill="var(--bg-elevated)" stroke="var(--border-strong)" stroke-width="0.8"/>
            <text x="10" y="18" class="tooltip-name">{{ hoveredNode()!.name }}</text>
            <text x="10" y="34" class="tooltip-detail">
              Load: {{ hoveredNode()!.currentKva | number:'1.0-0' }} / {{ hoveredNode()!.nameplateRating | number:'1.0-0' }} kVA
            </text>
            <text x="10" y="50" class="tooltip-detail">
              Status: {{ hoveredNode()!.status | uppercase }}
            </text>
            <text x="10" y="66" class="tooltip-detail">Meter ID: {{ hoveredNode()!.meterId }}</text>
          </g>
        }
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .topology-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary);
    }

    // Toolbar
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-card);
      flex-shrink: 0;

      &__title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.15em;
        color: var(--text-secondary);
      }

      &__controls {
        display: flex;
        align-items: center;
        gap: 16px;
      }
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .legend-sep {
      width: 1px;
      height: 16px;
      background: var(--border-subtle);
      margin: 0 4px;
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .zoom-btn {
      width: 24px;
      height: 24px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 3px;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;

      &:hover { background: var(--accent-blue-dim); border-color: var(--accent-blue); }

      &--reset { font-size: 12px; }
    }

    .zoom-level {
      font-size: 11px;
      color: var(--text-secondary);
      width: 38px;
      text-align: center;
    }

    // SVG Canvas
    .topology-svg {
      flex: 1;
      width: 100%;
      height: 100%;
      cursor: grab;
      display: block;

      &:active { cursor: grabbing; }
    }

    // SVG text styles
    :host ::ng-deep {
      .tier-label {
        font-family: var(--font-ui);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.15em;
        fill: rgba(0, 170, 255, 0.25);
        text-transform: uppercase;
      }

      .node-type-badge {
        font-family: var(--font-mono);
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-anchor: middle;
      }

      .node-name {
        font-family: var(--font-ui);
        font-size: 9px;
        font-weight: 600;
        fill: rgba(255,255,255,0.85);
        text-anchor: middle;
        letter-spacing: 0.02em;
      }

      .node-load {
        font-family: var(--font-mono);
        font-size: 10px;
        text-anchor: middle;
        font-weight: 700;
      }

      .edge-label {
        font-family: var(--font-mono);
        font-size: 9px;
        opacity: 0.8;
      }

      .tooltip-name {
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 600;
        fill: #e2eef8;
      }

      .tooltip-detail {
        font-family: var(--font-mono);
        font-size: 10px;
        fill: #7a9bbc;
      }
    }

    .node {
      transition: opacity 0.2s;

      &--critical { animation: glow-critical 1.5s ease-in-out infinite; }
      &--warning  { animation: glow-warning  2s   ease-in-out infinite; }
    }
  `]
})
export class GridTopologyComponent {
  nodes  = input<GridNode[]>([]);
  edges  = input<GridEdge[]>([]);
  nodeSelected = output<GridNode | null>();

  selectedNodeId = signal<string | null>(null);
  hoveredNodeId  = signal<string | null>(null);
  showEdgeLabels = signal(true);

  readonly svgW = 1200;
  readonly svgH = 640;

  private _transform = signal<Transform>({ x: 0, y: 0, scale: 1 });
  transform = this._transform.asReadonly();

  private isDragging = false;
  private dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

  nodeMap = computed(() => {
    const map: Record<string, GridNode> = {};
    this.nodes().forEach(n => { map[n.id] = n; });
    return map;
  });

  hoveredNode = computed(() => {
    const id = this.hoveredNodeId();
    return id ? this.nodeMap()[id] ?? null : null;
  });

  transformString = computed(() => {
    const t = this._transform();
    return `translate(${t.x}, ${t.y}) scale(${t.scale})`;
  });

  // ── Interaction ───────────────────────────────────────────────────

  onNodeClick(node: GridNode): void {
    const next = this.selectedNodeId() === node.id ? null : node.id;
    this.selectedNodeId.set(next);
    this.nodeSelected.emit(next ? node : null);
  }

  onMouseDown(e: MouseEvent): void {
    if ((e.target as SVGElement).closest('.node')) return;
    this.isDragging = true;
    const t = this._transform();
    this.dragStart = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    this._transform.update(t => ({ ...t, x: this.dragStart.tx + dx, y: this.dragStart.ty + dy }));
  }

  onMouseUp(e: any): void { this.isDragging = false; }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.zoom(delta);
  }

  zoom(delta: number): void {
    this._transform.update(t => ({
      ...t,
      scale: Math.min(2.5, Math.max(0.3, t.scale + delta))
    }));
  }

  resetTransform(): void {
    this._transform.set({ x: 0, y: 0, scale: 1 });
  }

  isEdgeRelatedToSelected(edge: GridEdge): boolean {
    const id = this.selectedNodeId();
    return id !== null && (edge.sourceId === id || edge.targetId === id);
  }

  // ── Shape Helpers ─────────────────────────────────────────────────

  hexPoints(r: number): string {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
    }).join(' ');
  }

  diamondPoints(r: number): string {
    return `0,${-r} ${r},0 0,${r} ${-r},0`;
  }

  getNodeRadius(type: NodeType): number {
    return type === 'ts' ? 40 : type === 'ss' ? 34 : 32;
  }

  getNodeFill(node: GridNode): string {
    const opacity = '22';
    const colors: Record<NodeType, string> = {
      ts: '#b71c1c', ss: '#004d40', dt: '#0d47a1',
    };
    return colors[node.type] + opacity;
  }

  getNodeStroke(node: GridNode): string {
    if (node.status === 'critical') return '#ff1744';
    if (node.status === 'warning')  return '#ffab00';
    const colors: Record<NodeType, string> = {
      ts: '#ff5252', ss: '#1de9b6', dt: '#448aff',
    };
    return colors[node.type];
  }

  getStatusColor(status: NodeStatus): string {
    const map: Record<NodeStatus, string> = {
      normal: '#00e676', warning: '#ffab00', critical: '#ff1744', offline: '#546e7a',
    };
    return map[status];
  }

  getLoadColor(loadPercent: number): string {
    if (loadPercent >= 90) return '#ff1744';
    if (loadPercent >= 75) return '#ffab00';
    return '#00e676';
  }

  getLoadArc(loadPercent: number, r: number): string {
    const circumference = 2 * Math.PI * r;
    const filled = (loadPercent / 100) * circumference;
    return `${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}`;
  }

  getShortName(name: string): string {
    return name.replace(/Injection Substation|Grid Station|Distribution Transformer/gi, '').trim().substring(0, 16);
  }

  getTooltipPos(node: GridNode): string {
    const t = this._transform();
    const tx = node.x * t.scale + t.x;
    const ty = node.y * t.scale + t.y;
    // Keep tooltip within SVG bounds
    const ttx = Math.min(tx + 20, this.svgW - 190);
    const tty = Math.min(ty - 90, this.svgH - 80);
    return `translate(${ttx}, ${Math.max(8, tty)})`;
  }
}
