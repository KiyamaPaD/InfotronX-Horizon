/**
 * Tutorial system for Mars Atlas
 */

export class Tutorial {
    constructor(steps) {
        this.steps = steps;
        this.currentStep = 0;
        this.overlay = document.getElementById('tutorial-overlay');
        this.box = document.getElementById('tutorial-box');
        this.title = document.getElementById('tutorial-title');
        this.text = document.getElementById('tutorial-text');
        this.prevBtn = document.getElementById('tutorial-prev');
        this.nextBtn = document.getElementById('tutorial-next');
        this.skipBtn = document.getElementById('tutorial-skip');
        this.pointer = document.getElementById('tutorial-pointer');
        
        this.init();
    }

    init() {
        this.prevBtn.onclick = () => this.prev();
        this.nextBtn.onclick = () => this.next();
        this.skipBtn.onclick = () => this.stop();
    }

    start() {
        this.currentStep = 0;
        this.previousStep = document.getElementById('mars-shell')?.dataset.step;
        document.querySelector('.workflow-all')?.click();
        this.overlay.hidden = false;
        this.showStep();
    }

    stop() {
        try { localStorage.setItem('mars-tutorial-seen', '1'); } catch {}
        this.overlay.hidden = true;
        this.clearHighlight();
        if (this.previousStep && this.previousStep !== 'all') {
            document.querySelector(`.workflow-step[data-step="${this.previousStep}"]`)?.click();
        }
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
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }

    showStep() {
        this.clearHighlight();
        const step = this.steps[this.currentStep];
        const target = document.querySelector(step.element);
        
        this.title.textContent = step.title;
        this.text.textContent = step.text;
        
        this.prevBtn.disabled = this.currentStep === 0;
        this.nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Finalizează' : 'Înainte';

        if (target) {
            target.classList.add('tutorial-highlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const rect = target.getBoundingClientRect();
            this.positionBox(rect, step.position || 'bottom');
        } else {
            // Center if no element found
            this.box.style.top = '50%';
            this.box.style.left = '50%';
            this.box.style.transform = 'translate(-50%, -50%)';
            this.pointer.hidden = true;
        }
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
