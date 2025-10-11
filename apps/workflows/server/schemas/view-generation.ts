/**
 * VIEW GENERATION SCHEMA
 *
 * Schema for AI_GENERATE_OBJECT to create custom views
 * Uses HTML + inline JS for maximum flexibility
 */

export const VIEW_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    html: {
      type: "string",
      description: `Complete HTML with inline CSS and JS for the custom view.

MUST FOLLOW THIS STRUCTURE:
<div id="view-root" style="font-family: system-ui; color: #fff; background: #0f1419; padding: 24px; border-radius: 12px;">
  <!-- Your HTML here -->
  <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Title from data</h2>
  <p style="color: #9ca3af; line-height: 1.6;">Content here</p>
  
  <script>
    // Access data via window.viewData
    const data = window.viewData || {};
    
    // Update DOM with data
    document.querySelector('h2').textContent = data.title || 'No title';
    
    // You can create complex interactions
    const button = document.createElement('button');
    button.textContent = 'Click me';
    button.onclick = () => {
      alert('Clicked! Value: ' + data.someField);
    };
    document.getElementById('view-root').appendChild(button);
  </script>
</div>

RULES:
1. Self-contained: All CSS inline, all JS in <script> tag
2. Data access: Use window.viewData (injected by iframe)
3. Styling: Use inline styles, match dark theme (#0f1419 bg, #fff text)
4. Colors: green-400 (#4ade80), cyan-400 (#22d3ee), gray-400 (#9ca3af)
5. No external resources (no CDN, no imports)
6. Must be safe (no eval, no dangerous APIs)

EXAMPLES:

For output view (display data):
<div style="...">
  <h2 id="title"></h2>
  <pre id="code"></pre>
  <script>
    const data = window.viewData;
    document.getElementById('title').textContent = data.poem;
    document.getElementById('code').textContent = JSON.stringify(data, null, 2);
  </script>
</div>

For input view (form):
<div style="...">
  <input id="name" type="text" placeholder="Enter name" style="..."/>
  <button id="submit" style="...">Submit</button>
  <script>
    document.getElementById('submit').onclick = () => {
      const name = document.getElementById('name').value;
      window.parent.postMessage({ type: 'submit', data: { name } }, '*');
    };
  </script>
</div>`,
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of the view design choices",
    },
  },
  required: ["html", "reasoning"],
};

export const VIEW_GENERATION_PROMPT_TEMPLATE = (
  purpose: string,
  viewType: "input" | "output",
  dataSchema: Record<string, unknown>,
) => `Generate a custom ${viewType} view for: ${purpose}

DATA SCHEMA:
${JSON.stringify(dataSchema, null, 2)}

Create beautiful, functional HTML with inline CSS and JavaScript.

${
  viewType === "output"
    ? `
OUTPUT VIEW REQUIREMENTS:
- Display all data from window.viewData
- Use cards, tables, lists for organization
- Highlight important info with colors
- Make it easy to scan
- Use dark theme colors
`
    : `
INPUT VIEW REQUIREMENTS:
- Create form inputs for each schema field
- Add labels and placeholders
- Submit button that posts data to parent
- Use: window.parent.postMessage({ type: 'submit', data: {...} }, '*')
- Validate inputs before submit
`
}

DESIGN SYSTEM:
- Background: #0f1419
- Text: #fff (white), #9ca3af (gray)
- Primary: #4ade80 (green)
- Secondary: #22d3ee (cyan)
- Accent: #a855f7 (purple)
- Borders: #1f2937
- Rounded: 12px, 8px
- Padding: 24px, 16px, 12px

Return complete, working HTML with <script> tag.`;
