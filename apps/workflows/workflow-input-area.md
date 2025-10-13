# Custom Input Views Feature 🎨

## Overview

This feature allows users to create custom input forms for workflow step fields. These views can use data from previous steps to populate options, show context, and provide a better UX than standard text inputs.

## Architecture

### Server-Side

**Schema & Prompt:**
- `server/schemas/input-view-generation.ts` - AI generation schema for input views
- Template provides examples for text inputs, selects populated from previous data, validation, etc.

**Tool:**
- `server/tools/views.ts` - `createGenerateStepInputViewTool`
- Generates custom HTML + inline CSS + JS based on:
  - Field name and schema
  - Optional previous step output (for dynamic options)
  - User's purpose/description

### Frontend

**Hook:**
- `view/src/hooks/useGenerateInputView.ts` - React Query mutation for generating views

**Components:**
- `view/src/components/CreateInputViewModal.tsx` - Modal to create new input views
  - Field name (auto-filled)
  - Purpose (what the view should do)
  - Optional previous step selection (to use its output data)
  
- `view/src/components/IframeViewRenderer.tsx` - Renders view in isolated iframe
  - Injects `window.viewData` with previous step output
  - Listens for `postMessage` with type `inputViewSubmit`

**Store:**
- `view/src/store/workflowStore.ts` - `addInputView()` method
- Structure: `inputViews: { fieldName: { view1: "HTML", view2: "HTML" } }`

**Main UI:**
- `view/src/routes/workflows.tsx` - Workflow builder page
  - Shows "+ Add View" button for each input field
  - Shows existing custom views as pills
  - Opens modal to render selected view
  - Handles `postMessage` to update field value

## Usage Flow

### 1. Create Input View

1. Navigate to a workflow step with input fields
2. Click "+ Add View" next to any input field
3. Fill in:
   - **View Name**: e.g., "view1", "categorySelector"
   - **Purpose**: Describe what the view should do
     - Example: "Create a dropdown populated with categories from previous step, with search functionality"
   - **Use Data From Previous Step** (optional): Select a previous step to use its output
4. Click "Generate View"
5. AI generates custom HTML + CSS + JS view

### 2. Use Input View

1. Click on a custom view pill (e.g., "view1")
2. Modal opens with iframe rendering the view
3. View receives previous step data via `window.viewData`
4. User interacts with custom form
5. Submit button sends data via `window.parent.postMessage`
6. Field value updates automatically
7. Modal closes

## Examples

### Simple Text Input with Character Counter

**Purpose:**
```
Text input with character counter and validation
```

**Generated View:**
```html
<div id="view-root" style="...">
  <label>Enter text (max 100 chars)</label>
  <input id="text" type="text" maxlength="100" />
  <p id="counter" style="color: #9ca3af;">0 / 100</p>
  <button id="submit">Submit</button>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const input = document.getElementById('text');
      const counter = document.getElementById('counter');
      
      input.addEventListener('input', function() {
        counter.textContent = `${input.value.length} / 100`;
      });
      
      document.getElementById('submit').onclick = function() {
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: { text: input.value }
        }, '*');
      };
    });
  </script>
</div>
```

### Select Populated from Previous Step

**Purpose:**
```
Dropdown to select a category from the categories returned by the previous step
```

**Previous Step Selected:** Step 1 (returns categories array)

**Generated View:**
```html
<div id="view-root" style="...">
  <label>Select Category</label>
  <select id="category"></select>
  <button id="submit">Submit</button>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const data = window.viewData || {};
      const select = document.getElementById('category');
      
      if (data.categories && Array.isArray(data.categories)) {
        data.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id || cat;
          option.textContent = cat.name || cat;
          select.appendChild(option);
        });
      }
      
      document.getElementById('submit').onclick = function() {
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: { category: select.value }
        }, '*');
      };
    });
  </script>
</div>
```

### Multi-Select with Search

**Purpose:**
```
Multi-select list with search functionality for items from previous step
```

**Previous Step Selected:** Step 2 (returns items array)

**Generated View:**
```html
<div id="view-root" style="...">
  <label>Select Items</label>
  <input id="search" type="text" placeholder="Search..." />
  <div id="items-list" style="max-height: 300px; overflow-y: auto;"></div>
  <button id="submit">Submit</button>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const data = window.viewData || {};
      const items = data.items || [];
      const selected = new Set();
      
      function renderItems(filter = '') {
        const list = document.getElementById('items-list');
        list.innerHTML = '';
        
        items
          .filter(item => 
            (item.name || item).toLowerCase().includes(filter.toLowerCase())
          )
          .forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 8px; border: 1px solid #1f2937; margin: 4px 0; cursor: pointer;';
            div.textContent = item.name || item;
            
            if (selected.has(item.id || item)) {
              div.style.background = '#00ff88';
              div.style.color = '#000';
            }
            
            div.onclick = function() {
              const id = item.id || item;
              if (selected.has(id)) {
                selected.delete(id);
              } else {
                selected.add(id);
              }
              renderItems(filter);
            };
            
            list.appendChild(div);
          });
      }
      
      document.getElementById('search').addEventListener('input', function(e) {
        renderItems(e.target.value);
      });
      
      renderItems();
      
      document.getElementById('submit').onclick = function() {
        window.parent.postMessage({
          type: 'inputViewSubmit',
          data: { items: Array.from(selected) }
        }, '*');
      };
    });
  </script>
</div>
```

## Technical Details

### PostMessage Protocol

Input views must send data using this format:

```javascript
window.parent.postMessage({
  type: 'inputViewSubmit',
  data: {
    // Field values
    fieldName: fieldValue,
    // or any structure
  }
}, '*');
```

### Data Injection

Previous step data is injected as:

```javascript
window.viewData = { /* previous step output */ }
```

Available in:
- `<head>` (synchronous, before user scripts)
- Via `postMessage` event (after load)

### View Requirements

1. **All CSS inline** - No external stylesheets
2. **All JS in single `<script>` tag**
3. **Wrap in DOMContentLoaded** - Avoid race conditions
4. **Never use IIFE** - `(function() {...})()` causes issues
5. **Validate data** - Always check if `window.viewData` exists
6. **Use console.log** - For debugging
7. **Submit via postMessage** - Only way to send data to parent

### Design System

- Background: `#0f1419` (dark), `#111827` (surface)
- Text: `#fff` (white), `#d1d5db` (light gray), `#9ca3af` (gray)
- Primary: `#00ff88` (green neon) - CTAs
- Secondary: `#22d3ee` (cyan) - links
- Accent: `#a855f7` (purple) - highlights
- Borders: `#1f2937`, `#374151`
- Radius: `12px` (large), `8px` (medium), `6px` (small)

## Benefits

✅ **Better UX** - Custom forms tailored to specific use cases
✅ **Dynamic Options** - Populate dropdowns from previous steps
✅ **Validation** - Custom validation rules
✅ **Visual Feedback** - Interactive elements, progress indicators
✅ **Flexible** - AI generates any HTML/CSS/JS structure
✅ **Type-Safe** - Zustand store + TypeScript types
✅ **Isolated** - Iframe sandbox prevents conflicts

## Future Enhancements

- [ ] View templates library (common patterns)
- [ ] View preview before save
- [ ] Edit existing views
- [ ] Share views between steps
- [ ] Export/import view definitions
- [ ] Advanced validation rules
- [ ] Multi-field views (one view for multiple inputs)

## Testing Checklist

- [x] Create input view for a field
- [x] Select previous step as data source
- [x] Generate view with AI
- [x] Render view in iframe
- [x] Receive previous step data in view
- [x] Submit data via postMessage
- [x] Update field value in step
- [x] Close modal after submit
- [ ] Test with real workflow (end-to-end)

---

**Next Steps:** Test the complete flow with a real workflow that has multiple steps and dependencies!
