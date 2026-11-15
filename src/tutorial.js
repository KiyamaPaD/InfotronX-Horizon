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
        const gap = 20;
        let top, left;

        if (position === 'bottom') {
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2 - 160;
            this.pointer.style.top = '-10px';
            this.pointer.style.left = '50%';
            this.pointer.style.transform = 'translateX(-50%) rotate(45deg)';
        } else if (position === 'top') {
            top = rect.top - this.box.offsetHeight - gap;
            left = rect.left + rect.width / 2 - 160;
            this.pointer.style.bottom = '-10px';
            this.pointer.style.left = '50%';
            this.pointer.style.transform = 'translateX(-50%) rotate(45deg)';
        } else if (position === 'right') {
            top = rect.top + rect.height / 2 - this.box.offsetHeight / 2;
            left = rect.right + gap;
            this.pointer.style.left = '-10px';
            this.pointer.style.top = '50%';
            this.pointer.style.transform = 'translateY(-50%) rotate(45deg)';
        } else if (position === 'left') {
            top = rect.top + rect.height / 2 - this.box.offsetHeight / 2;
            left = rect.left - 320 - gap;
            this.pointer.style.right = '-10px';
            this.pointer.style.top = '50%';
            this.pointer.style.transform = 'translateY(-50%) rotate(45deg)';
        }

        // Keep inside window
        left = Math.max(10, Math.min(left, window.innerWidth - 330));
        top = Math.max(10, Math.min(top, window.innerHeight - this.box.offsetHeight - 10));

        this.box.style.top = `${top}px`;
        this.box.style.left = `${left}px`;
        this.box.style.transform = 'none';
    }
}
