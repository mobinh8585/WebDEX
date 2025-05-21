import { SoundPlayer } from '../core/soundPlayer.js';

const CalculatorAppMethods = {
    calculate: (current, previous, op) => {
        const prevNum = parseFloat(previous);
        const currentNum = parseFloat(current);
        if (isNaN(prevNum) || isNaN(currentNum)) return 'Error';

        let result;
        switch (op) {
            case '+': result = prevNum + currentNum; break;
            case '-': result = prevNum - currentNum; break;
            case '*': result = prevNum * currentNum; break;
            case '/': result = currentNum === 0 ? 'Error' : prevNum / currentNum; break;
            default: return parseFloat(current) || 0; // Should not happen
        }
        if (result === 'Error') return 'Error';
        return parseFloat(result.toPrecision(12)); // Limit precision to avoid floating point issues
    }
};

export const calculatorAppConfig = {
    name:'Calculator', icon:'🧮', width:320, height:450, allowMultiple:true,
    launch: (windowId, contentArea) => {
        if(!contentArea) return;
        contentArea.id = `calculator-content-${windowId}`; // For specific styling

        const displayId = `calc-display-${windowId}`;
        contentArea.innerHTML = `
            <div id="${displayId}" class="calc-display" aria-live="polite">0</div>
            <button data-val="C" class="clear">C</button>
            <button data-val="←" class="operator" aria-label="Backspace">←</button>
            <button data-val="/" class="operator" aria-label="Divide">÷</button>
            <button data-val="*" class="operator" aria-label="Multiply">×</button>
            <button data-val="7">7</button> <button data-val="8">8</button> <button data-val="9">9</button>
            <button data-val="-" class="operator" aria-label="Subtract">-</button>
            <button data-val="4">4</button> <button data-val="5">5</button> <button data-val="6">6</button>
            <button data-val="+" class="operator" aria-label="Add">+</button>
            <button data-val="1">1</button> <button data-val="2">2</button> <button data-val="3">3</button>
            <button data-val="=" class="equals" style="grid-row:span 2" aria-label="Equals">=</button>
            <button data-val="0" style="grid-column:span 2">0</button>
            <button data-val=".">.</button>`;

        const display = contentArea.querySelector(`#${displayId}`);
        if (!display) { console.error(`Calculator: Display element not found for ${windowId}`); return; }

        let currentInput = '0';
        let previousInput = '';
        let operator = null;
        let waitingForOperand = false; // True after an operator is pressed, waiting for next number

        contentArea.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                SoundPlayer.playSound('click');
                const value = button.dataset.val;

                if (!isNaN(parseFloat(value))) { // Number
                    if (waitingForOperand || currentInput === '0') {
                        currentInput = value;
                        waitingForOperand = false;
                    } else {
                        currentInput += value;
                    }
                } else if (value === '.') { // Decimal
                    if (waitingForOperand) {
                        currentInput = '0.';
                        waitingForOperand = false;
                    } else if (!currentInput.includes('.')) {
                        currentInput += '.';
                    }
                } else if (value === 'C') { // Clear
                    currentInput = '0';
                    previousInput = '';
                    operator = null;
                    waitingForOperand = false;
                } else if (value === '←') { // Backspace
                    currentInput = currentInput.slice(0, -1) || '0';
                    if (waitingForOperand && currentInput === '0') waitingForOperand = false; // Allow re-entry after backspacing operator result
                } else if (['+', '-', '*', '/'].includes(value)) { // Operator
                    if (operator && !waitingForOperand && previousInput) { // Chain operations: 1+2+ -> 3+
                        currentInput = CalculatorAppMethods.calculate(currentInput, previousInput, operator).toString();
                    }
                    previousInput = currentInput;
                    operator = value;
                    waitingForOperand = true;
                } else if (value === '=') { // Equals
                    if (operator && previousInput) {
                        currentInput = CalculatorAppMethods.calculate(currentInput, previousInput, operator).toString();
                        previousInput = ''; // Reset for next calculation
                        operator = null;
                        waitingForOperand = true; // Result can be start of new calculation or overwritten
                    }
                }
                // Truncate or use scientific notation for display if too long
                let displayText = currentInput;
                if (displayText.length > 12 && displayText !== "Error") {
                    try { displayText = parseFloat(displayText).toExponential(6); } catch(e) { /* ignore */ }
                }
                display.textContent = displayText;
            });
        });
    }
};