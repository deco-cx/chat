/**
 * OUTPUT VIEW GENERATION SCHEMA
 *
 * Schema for AI to generate custom output views
 * HTML + inline JS function that renders step output data
 */

export const OUTPUT_VIEW_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    viewCode: {
      type: "string",
      description: `Complete HTML with inline CSS and JavaScript function for rendering output data.

MANDATORY STRUCTURE:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px; color: #fff; font-family: system-ui;">
  <!-- HTML elements with IDs for data binding -->
  <h2 id="title" style="color: #4ade80; font-size: 24px; font-weight: bold; margin-bottom: 16px;"></h2>
  <div id="content" style="color: #d1d5db; font-size: 16px; line-height: 1.6;"></div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Data injected by iframe as window.viewData
      const data = window.viewData || {};
      
      console.log('🎨 [CustomView] Rendering with data:', data);
      
      // Validate data exists
      if (!data || Object.keys(data).length === 0) {
        console.error('❌ [CustomView] No data received!');
        document.getElementById('view-root').innerHTML = '<p style="color: #f87171;">Error: No data received</p>';
        return;
      }
      
      // Update DOM elements with data
      document.getElementById('title').textContent = data.title || 'No Title';
      document.getElementById('content').textContent = data.content || 'No Content';
      
      // Add interactive elements (buttons, etc)
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.style.cssText = 'padding: 8px 16px; background: #00ff88; color: #000; border: none; border-radius: 6px; cursor: pointer; margin-top: 12px; font-weight: 600;';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
      };
      document.getElementById('view-root').appendChild(copyBtn);
      
      console.log('✅ [CustomView] Render complete');
    });
  </script>
</div>

DESIGN SYSTEM (Inline Styles):
- Background: #0f1419 (dark), #111827 (surface)
- Text: #fff (white), #d1d5db (light gray), #9ca3af (gray), #6b7280 (muted)
- Primary: #00ff88 (green neon) - use for CTAs
- Secondary: #22d3ee (cyan) - use for links
- Accent: #a855f7 (purple) - use for highlights
- Borders: #1f2937, #374151
- Radius: 12px (large), 8px (medium), 6px (small)
- Shadows: 0 10px 40px rgba(0, 255, 136, 0.2)

GUIDELINES:
1. All CSS must be inline (no classes, no external sheets)
2. All JavaScript in single <script> tag
3. CRITICAL: Wrap JS in DOMContentLoaded: document.addEventListener('DOMContentLoaded', function() { ... });
4. NEVER use IIFE: (function() { ... })() - it causes race conditions!
5. Access data: const data = window.viewData || {};
6. ALWAYS validate data first: if (!data || Object.keys(data).length === 0) { show error; return; }
7. Use console.log for debugging
8. Add interactive elements when helpful (copy, expand, filter)
9. Make it beautiful and easy to understand
10. Handle missing data gracefully (use || 'N/A')
11. No eval(), no Function(), no dangerous APIs
12. Test data paths exist before using

EXAMPLES:

Simple text display:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px;">
  <h3 style="color: #4ade80; margin-bottom: 12px;">Result</h3>
  <p id="text" style="color: #d1d5db; font-size: 16px;"></p>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const data = window.viewData || {};
      if (!data || !data.text) {
        document.getElementById('text').textContent = 'No data';
        return;
      }
      document.getElementById('text').textContent = data.text;
    });
  </script>
</div>

Table with scores:
<div id="view-root" style="padding: 24px; background: #0f1419; border-radius: 12px;">
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="border-bottom: 1px solid #1f2937;">
        <th style="text-align: left; padding: 12px; color: #9ca3af;">Metric</th>
        <th style="text-align: right; padding: 12px; color: #9ca3af;">Score</th>
      </tr>
    </thead>
    <tbody id="table-body"></tbody>
  </table>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const data = window.viewData || {};
      const tbody = document.getElementById('table-body');
      
      if (!data || Object.keys(data).length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 12px; color: #f87171;">No data</td></tr>';
        return;
      }
      
      Object.entries(data).forEach(([key, value]) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #1f2937';
        row.innerHTML = \`
          <td style="padding: 12px; color: #d1d5db;">\${key}</td>
          <td style="padding: 12px; color: #4ade80; text-align: right; font-weight: 600;">\${value}</td>
        \`;
        tbody.appendChild(row);
      });
    });
  </script>
</div>`,
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of the view design choices",
    },
  },
  required: ["viewCode", "reasoning"],
};

export const OUTPUT_VIEW_PROMPT_TEMPLATE = (
  stepName: string,
  outputSchema: Record<string, unknown>,
  outputSample: string,
  purpose: string,
) => {
  const schemaFields = JSON.stringify(
    (outputSchema as any).properties || {},
    null,
    2,
  );

  return `Generate a custom output view for step: "${stepName}"

PURPOSE: ${purpose}

OUTPUT SCHEMA (Available fields):
${schemaFields}

OUTPUT SAMPLE (first 100 chars of actual data):
${outputSample}

Create beautiful HTML with inline CSS and JavaScript that:
1. Displays the data in an engaging, easy-to-read way
2. Highlights important information with colors/badges
3. Adds helpful interactions (copy buttons, expand/collapse, filters)
4. Matches the dark theme design system (see schema description)
5. Uses console.logs for debugging
6. CRITICAL: Wraps all JS in DOMContentLoaded: document.addEventListener('DOMContentLoaded', function() { ... });
7. NEVER use IIFE pattern - it causes race conditions!
8. ALWAYS validate data exists before using

The view will receive data via window.viewData in the iframe.
Access like: const data = window.viewData || {};
ALWAYS check if data exists: if (!data || Object.keys(data).length === 0) { show error; return; }

Return complete, self-contained HTML ready to render.`;
};
