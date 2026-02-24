import { MAP_DEFINITIONS, CELL } from '../map/MapData.js';

export class MapSelectUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.selectedIndex = 0;
        this.onSelect = null;
        this.onBack = null;
    }

    show() {
        this.element = document.createElement('div');
        this.element.className = 'map-select-screen';

        let cardsHTML = '';
        MAP_DEFINITIONS.forEach((map, i) => {
            const stars = '★'.repeat(map.difficulty) + '☆'.repeat(5 - map.difficulty);
            cardsHTML += `
                <div class="map-card ${i === 0 ? 'selected' : ''}" data-index="${i}">
                    <div class="map-preview"><canvas id="map-preview-${i}" width="128" height="96"></canvas></div>
                    <div class="map-name">${map.name}</div>
                    <div class="map-difficulty">
                        <span class="star">${stars.slice(0, map.difficulty)}</span><span class="star-empty">${stars.slice(map.difficulty)}</span>
                    </div>
                </div>
            `;
        });

        this.element.innerHTML = `
            <div class="map-select-title">Select Map</div>
            <div class="map-grid">${cardsHTML}</div>
            <div class="map-select-actions">
                <button class="menu-btn" id="map-back">BACK</button>
                <button class="menu-btn primary" id="map-play">PLAY</button>
            </div>
        `;
        this.container.appendChild(this.element);

        // Draw mini previews
        MAP_DEFINITIONS.forEach((map, i) => {
            this.drawPreview(i, map);
        });

        // Card selection
        this.element.querySelectorAll('.map-card').forEach((card) => {
            card.addEventListener('click', () => {
                this.element.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedIndex = parseInt(card.dataset.index);
            });
        });

        document.getElementById('map-play').addEventListener('click', () => {
            if (this.onSelect) this.onSelect(this.selectedIndex);
        });

        document.getElementById('map-back').addEventListener('click', () => {
            if (this.onBack) this.onBack();
        });
    }

    drawPreview(index, map) {
        const canvas = document.getElementById(`map-preview-${index}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cellW = canvas.width / map.cols;
        const cellH = canvas.height / map.rows;

        for (let z = 0; z < map.rows; z++) {
            for (let x = 0; x < map.cols; x++) {
                const cell = map.grid[z][x];
                switch (cell) {
                    case CELL.WALL:
                        ctx.fillStyle = '#' + map.theme.wallColor.toString(16).padStart(6, '0');
                        break;
                    case CELL.BLOCK:
                        ctx.fillStyle = '#' + map.theme.blockColor.toString(16).padStart(6, '0');
                        break;
                    case CELL.SPAWN_P1:
                        ctx.fillStyle = '#42a5f5';
                        break;
                    case CELL.SPAWN_P2:
                        ctx.fillStyle = '#ef5350';
                        break;
                    case CELL.SPAWN_P3:
                        ctx.fillStyle = '#66bb6a';
                        break;
                    case CELL.SPAWN_P4:
                        ctx.fillStyle = '#ffa726';
                        break;
                    default:
                        ctx.fillStyle = '#' + map.theme.floorColor.toString(16).padStart(6, '0');
                }
                ctx.fillRect(x * cellW, z * cellH, cellW + 0.5, cellH + 0.5);
            }
        }
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
