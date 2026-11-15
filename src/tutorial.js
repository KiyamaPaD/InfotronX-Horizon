/**
 * Guided tour for Mars Atlas. Each step can switch the workspace view first, so what it points at is on screen.
 * A step whose target is missing or hidden is shown in the middle of the screen instead of being skipped.
 */

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export class Tutorial {
    constructor(steps) {
        this.steps = steps;
        this.currentStep = 0;
        this.active = false;
        this.token = 0;
        this.target = null;
        this.overlay = document.getElementById('tutorial-overlay');
        this.box = document.getElementById('tutorial-box');
        this.chapter = document.getElementById('tutorial-chapter');
        this.title = document.getElementById('tutorial-title');
        this.text = document.getElementById('tutorial-text');
        this.count = document.getElementById('tutorial-count');
        this.bar = document.getElementById('tutorial-bar');
        this.prevBtn = document.getElementById('tutorial-prev');
        this.nextBtn = document.getElementById('tutorial-next');
        this.skipBtn = document.getElementById('tutorial-skip');
        this.pointer = document.getElementById('tutorial-pointer');
        this.mascot = document.getElementById('tutorial-mascot');

        this.init();
    }

    init() {
        this.prevBtn.onclick = () => this.prev();
        this.nextBtn.onclick = () => this.next();
        this.skipBtn.onclick = () => this.stop();
        document.addEventListener('keydown', event => {
            if (!this.active) {
                return;
            }

            if (event.key === 'ArrowRight') {
                this.next();
            } else if (event.key === 'ArrowLeft') {
                this.prev();
            } else if (event.key === 'Escape') {
                this.stop();
            }
        });
        window.addEventListener('resize', () => {
            if (this.active) {
                this.place();
            }
        });
    }

    start() {
        this.currentStep = 0;
        this.active = true;
        this.previousView = document.getElementById('mars-shell')?.dataset.step;
        this.overlay.hidden = false;
        this.showStep();
        this.nextBtn.focus({ preventScroll: true });
    }

    stop() {
        try { localStorage.setItem('mars-tutorial-seen', '1'); } catch { /* storage blocked: the tour may show again */ }
        this.active = false;
        this.token++;
        this.overlay.hidden = true;
        this.clearHighlight();
        this.switchView(this.previousView && this.previousView !== 'all' ? this.previousView : 'all');
    }

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep();
        } else {
            this.stop();
        }
    }

    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    }

    clearHighlight() {
        document.querySelectorAll('.tutorial-highlight').forEach(element => {
            element.classList.remove('tutorial-highlight');
        });
    }

    switchView(view) {
        const shell = document.getElementById('mars-shell');

        if (!shell || shell.dataset.step === view) {
            return false;
        }

        const button = view === 'all'
            ? shell.querySelector('.workflow-all')
            : shell.querySelector(`.workflow-step[data-step="${view}"]`);
        button?.click();
        return Boolean(button);
    }

    async showStep() {
        const token = ++this.token;
        const step = this.steps[this.currentStep];
        this.clearHighlight();

        this.chapter.textContent = step.chapter || '';
        this.title.textContent = step.title;
        this.text.textContent = step.text;
        this.count.textContent = `Step ${this.currentStep + 1} of ${this.steps.length}`;
        this.bar.style.width = `${(this.currentStep + 1) / this.steps.length * 100}%`;
        this.prevBtn.disabled = this.currentStep === 0;
        this.nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next';

        if (step.view && this.switchView(step.view)) {
            await wait(520);
        }

        if (token !== this.token || !this.active) {
            return;
        }

        const found = step.element ? document.querySelector(step.element) : null;
        this.target = found && found.getClientRects().length ? found : null;

        if (this.target) {
            this.target.classList.add('tutorial-highlight');
            this.target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        }

        this.place();
    }

    place() {
        const step = this.steps[this.currentStep];

        if (!this.target) {
            this.pointer.hidden = true;
            this.box.style.top = '50%';
            this.box.style.left = '50%';
            this.box.style.transform = 'translate(-50%, -50%)';
            this.placeMascot();
            return;
        }

        this.positionBox(this.target.getBoundingClientRect(), step.position || 'bottom');
        this.placeMascot();
    }

    // The guide stands in a free corner of the screen, never on the tutorial box or on what the box points at, and turns towards the box.
    placeMascot() {
        if (!this.mascot) {
            return;
        }

        const width = 110, height = 150, margin = 16;
        const box = this.box.getBoundingClientRect();
        const target = this.target ? this.target.getBoundingClientRect() : null;
        const overlaps = (a, b) => b && a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
        const corners = [
            { name: 'bottom-right', left: window.innerWidth - width - margin, top: window.innerHeight - height - margin },
            { name: 'bottom-left', left: margin, top: window.innerHeight - height - margin },
            { name: 'top-right', left: window.innerWidth - width - margin, top: margin + 60 },
            { name: 'top-left', left: margin, top: margin + 60 }
        ];
        const boxCentre = box.left + box.width / 2;
        // Prefer the corner on the side away from the box.
        corners.sort((a, b) => Math.abs((b.left + width / 2) - boxCentre) - Math.abs((a.left + width / 2) - boxCentre));
        const free = corners.find(corner => {
            const rect = { left: corner.left, top: corner.top, right: corner.left + width, bottom: corner.top + height };
            return !overlaps(rect, box) && !overlaps(rect, target);
        });

        if (!free) {
            this.mascot.hidden = true;
            return;
        }

        this.mascot.hidden = false;
        this.mascot.style.left = free.left + 'px';
        this.mascot.style.top = free.top + 'px';
        const step = this.steps[this.currentStep];
        const towardsBox = free.left + width / 2 < boxCentre ? 'point-right' : 'point-left';
        const last = this.currentStep === this.steps.length - 1;
        const pose = this.currentStep === 0 ? 'wave' : last ? 'cheer' : step.pose || towardsBox;
        this.mascot.className = 'tutorial-mascot pose-' + pose;
    }

    positionBox(rect, position) {
        this.pointer.hidden = false;
        // Reset everything from the previous step, then place the box and aim the pointer at the target's centre.
        this.pointer.style.cssText = '';
        const gap = 20;
        const width = this.box.offsetWidth, height = this.box.offsetHeight;
        let top, left;

        if (position === 'bottom') {
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2 - width / 2;
        } else if (position === 'top') {
            top = rect.top - height - gap;
            left = rect.left + rect.width / 2 - width / 2;
        } else if (position === 'right') {
            top = rect.top + rect.height / 2 - height / 2;
            left = rect.right + gap;
        } else {
            top = rect.top + rect.height / 2 - height / 2;
            left = rect.left - width - gap;
        }

        left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - height - 10));
        this.box.style.top = `${top}px`;
        this.box.style.left = `${left}px`;
        this.box.style.transform = 'none';

        const line = '1px solid #577085';
        const centreX = Math.max(24, Math.min(width - 24, rect.left + rect.width / 2 - left));
        const centreY = Math.max(24, Math.min(height - 24, rect.top + rect.height / 2 - top));
        const style = this.pointer.style;
        style.border = '0';

        // The diamond sits on the edge facing the target; only its two outer sides get a line.
        if (position === 'bottom') {
            style.left = `${centreX - 10}px`; style.top = '-10px'; style.borderTop = line; style.borderLeft = line;
        } else if (position === 'top') {
            style.left = `${centreX - 10}px`; style.top = `${height - 10}px`; style.borderBottom = line; style.borderRight = line;
        } else if (position === 'right') {
            style.top = `${centreY - 10}px`; style.left = '-10px'; style.borderBottom = line; style.borderLeft = line;
        } else {
            style.top = `${centreY - 10}px`; style.left = `${width - 10}px`; style.borderTop = line; style.borderRight = line;
        }

        style.transform = 'rotate(45deg)';
    }
}
