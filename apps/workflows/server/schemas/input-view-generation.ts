/**
 * INPUT VIEW GENERATION SCHEMA
 *
 * Schema for AI to generate custom input views
 * HTML + inline JS with postMessage to submit data
 */

export const INPUT_VIEW_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    viewCode: {
      type: "string",
      description: `Complete HTML with inline CSS and JavaScript for custom input form.

MANDATORY STRUCTURE:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px; color: #fff; font-family: system-ui;">
  <!-- Form elements with proper labels -->
  <label style="display: block; color: #9ca3af; font-size: 14px; margin-bottom: 8px;">Field Label</label>
  <input id="field" type="text" style="width: 100%; padding: 12px; background: #111827; border: 1px solid #1f2937; border-radius: 6px; color: #fff; font-size: 16px;" />
  
  <button id="submit" style="margin-top: 16px; padding: 12px 24px; background: #00ff88; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 16px;">
    Submit
  </button>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Access previous step data (if available)
      const data = window.viewData || {};
      
      console.log('📝 [InputView] Initializing with data:', data);
      
      // Example: Populate dropdown from previous step data
      if (data.items && Array.isArray(data.items)) {
        const select = document.getElementById('category');
        data.items.forEach(item => {
          const option = document.createElement('option');
          option.value = item.id || item;
          option.textContent = item.name || item;
          select.appendChild(option);
        });
      }
      
      // Submit handler
      document.getElementById('submit').onclick = function() {
        // Collect form data
        const formData = {
          fieldName: document.getElementById('field').value,
          // Add more fields as needed
        };
        
        console.log('📤 [InputView] Submitting:', formData);
        
        // Send to parent window via postMessage
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: formData
        }, '*');
      };
    });
  </script>
</div>

DESIGN SYSTEM (Inline Styles):
- Background: #0f1419 (dark), #111827 (surface), #1a1a1a (hover)
- Text: #fff (white), #d1d5db (light gray), #9ca3af (gray), #6b7280 (muted)
- Primary: #00ff88 (green neon) - use for submit buttons
- Secondary: #22d3ee (cyan) - use for secondary actions
- Accent: #a855f7 (purple) - use for highlights
- Borders: #1f2937, #374151
- Input: #111827 background, #1f2937 border
- Radius: 12px (large), 8px (medium), 6px (small)
- Shadows: 0 10px 40px rgba(0, 255, 136, 0.2)

INPUT ELEMENTS:
- Text input: padding: 12px, background: #111827, border: 1px solid #1f2937, border-radius: 6px
- Select: same as text input
- Textarea: same as text input + resize: vertical
- Checkbox: accent-color: #00ff88
- Submit button: background: #00ff88, color: #000, padding: 12px 24px, font-weight: 600

GUIDELINES:
1. All CSS must be inline (no classes, no external sheets)
2. All JavaScript in single <script> tag
3. CRITICAL: Wrap JS in DOMContentLoaded: document.addEventListener('DOMContentLoaded', function() { ... });
4. NEVER use IIFE: (function() { ... })() - it causes race conditions!
5. Access previous step data: const data = window.viewData || {};
6. Submit via postMessage: window.parent.postMessage({ type: 'inputViewSubmit', data: { ... } }, '*');
7. Use console.log for debugging
8. Validate inputs before submitting
9. Provide user feedback (disable button, show loading state)
10. Handle missing data gracefully
11. Make form accessible (labels, placeholders, hints)

EXAMPLES:

Simple text input:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px;">
  <h3 style="color: #4ade80; margin-bottom: 16px; font-size: 20px;">Enter Text</h3>
  <label style="display: block; color: #9ca3af; font-size: 14px; margin-bottom: 8px;">
    Message (max 100 chars)
  </label>
  <input id="text" type="text" maxlength="100" placeholder="Type here..."
    style="width: 100%; padding: 12px; background: #111827; border: 1px solid #1f2937; border-radius: 6px; color: #fff; font-size: 16px; outline: none;" />
  <p id="counter" style="color: #9ca3af; font-size: 12px; margin-top: 8px;">0 / 100</p>
  <button id="submit" style="margin-top: 16px; padding: 12px 24px; background: #00ff88; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 16px; width: 100%;">
    Submit
  </button>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const input = document.getElementById('text');
      const counter = document.getElementById('counter');
      const button = document.getElementById('submit');
      
      input.addEventListener('input', function() {
        counter.textContent = input.value.length + ' / 100';
      });
      
      button.onclick = function() {
        const value = input.value.trim();
        if (!value) {
          alert('Please enter some text');
          return;
        }
        
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: { text: value }
        }, '*');
      };
    });
  </script>
</div>

Select from previous step:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px;">
  <h3 style="color: #4ade80; margin-bottom: 16px; font-size: 20px;">Select Category</h3>
  <label style="display: block; color: #9ca3af; font-size: 14px; margin-bottom: 8px;">
    Choose from available categories
  </label>
  <select id="category" style="width: 100%; padding: 12px; background: #111827; border: 1px solid #1f2937; border-radius: 6px; color: #fff; font-size: 16px; outline: none;">
    <option value="">-- Select --</option>
  </select>
  <button id="submit" style="margin-top: 16px; padding: 12px 24px; background: #00ff88; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 16px; width: 100%;">
    Submit
  </button>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const data = window.viewData || {};
      const select = document.getElementById('category');
      const button = document.getElementById('submit');
      
      console.log('📦 Received data:', data);
      
      if (data.categories && Array.isArray(data.categories)) {
        data.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id || cat;
          option.textContent = cat.name || cat;
          select.appendChild(option);
        });
      } else {
        select.innerHTML = '<option value="">No categories available</option>';
      }
      
      button.onclick = function() {
        const value = select.value;
        if (!value) {
          alert('Please select a category');
          return;
        }
        
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: { category: value }
        }, '*');
      };
    });
  </script>
</div>

Multi-select with search:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px;">
  <h3 style="color: #4ade80; margin-bottom: 16px; font-size: 20px;">Select Items</h3>
  <input id="search" type="text" placeholder="Search..." 
    style="width: 100%; padding: 12px; background: #111827; border: 1px solid #1f2937; border-radius: 6px; color: #fff; font-size: 16px; margin-bottom: 12px; outline: none;" />
  <div id="items-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #1f2937; border-radius: 6px; padding: 8px;"></div>
  <p id="selected-count" style="color: #9ca3af; font-size: 14px; margin-top: 12px;">0 items selected</p>
  <button id="submit" style="margin-top: 16px; padding: 12px 24px; background: #00ff88; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 16px; width: 100%;">
    Submit
  </button>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const data = window.viewData || {};
      const items = data.items || [];
      const selected = new Set();
      
      function renderItems(filter) {
        filter = filter || '';
        const list = document.getElementById('items-list');
        list.innerHTML = '';
        
        items
          .filter(item => (item.name || item).toLowerCase().includes(filter.toLowerCase()))
          .forEach(item => {
            const div = document.createElement('div');
            const id = item.id || item;
            div.style.cssText = 'padding: 12px; border: 1px solid #1f2937; margin: 4px 0; cursor: pointer; border-radius: 6px; transition: all 0.2s;';
            div.textContent = item.name || item;
            
            if (selected.has(id)) {
              div.style.background = '#00ff88';
              div.style.color = '#000';
              div.style.fontWeight = '600';
            }
            
            div.onclick = function() {
              if (selected.has(id)) {
                selected.delete(id);
              } else {
                selected.add(id);
              }
              renderItems(filter);
              document.getElementById('selected-count').textContent = selected.size + ' items selected';
            };
            
            list.appendChild(div);
          });
      }
      
      document.getElementById('search').addEventListener('input', function(e) {
        renderItems(e.target.value);
      });
      
      renderItems();
      
      document.getElementById('submit').onclick = function() {
        if (selected.size === 0) {
          alert('Please select at least one item');
          return;
        }
        
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: { items: Array.from(selected) }
        }, '*');
      };
    });
  </script>
</div>`,
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of the input view design choices",
    },
  },
  required: ["viewCode", "reasoning"],
};

export const INPUT_VIEW_PROMPT_TEMPLATE = (
  fieldName: string,
  fieldSchema: Record<string, unknown>,
  previousStepOutput: string | undefined,
  purpose: string,
) => {
  const schemaInfo = JSON.stringify(fieldSchema, null, 2);

  return `Generate a custom input view for field: "${fieldName}"

PURPOSE: ${purpose}

FIELD SCHEMA:
${schemaInfo}

${
  previousStepOutput
    ? `PREVIOUS STEP DATA (use to populate options):
${previousStepOutput}`
    : "No previous step data available."
}

Create beautiful HTML with inline CSS and JavaScript that:
1. Provides an intuitive input interface for this field
2. ${previousStepOutput ? "Uses previous step data to populate dropdowns/options" : "Allows user to enter data"}
3. Validates input before submission
4. Provides visual feedback (character counters, selection counts, etc)
5. Matches the dark theme design system (see schema description)
6. Uses console.logs for debugging
7. CRITICAL: Wraps all JS in DOMContentLoaded: document.addEventListener('DOMContentLoaded', function() { ... });
8. NEVER use IIFE pattern - it causes race conditions!
9. Submits via postMessage: window.parent.postMessage({ type: 'inputViewSubmit', data: { fieldName: value } }, '*');

The view will receive previous step data via window.viewData in the iframe.
Access like: const data = window.viewData || {};

Return complete, self-contained HTML ready to render.`;
};
