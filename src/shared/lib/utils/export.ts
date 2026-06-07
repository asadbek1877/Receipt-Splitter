// src/shared/lib/utils/export.ts
// PDF and Excel (CSV) export utility
// Uses React Native Share API for cross-platform sharing

import { Share, Platform } from 'react-native';

export interface ExportData {
  title: string;
  date: string;
  summary: {
    totalSpent: number;
    totalSessions: number;
    averagePerSession: number;
    currency: string;
  };
  categories?: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;
    category?: string;
    participants?: string[];
  }>;
}

/**
 * Generate CSV content from export data
 */
export function generateCSV(data: ExportData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`"${data.title}"`);
  lines.push(`"Generated: ${data.date}"`);
  lines.push('');
  
  // Summary
  lines.push('"=== SUMMARY ==="');
  lines.push(`"Total Spent","${data.summary.totalSpent} ${data.summary.currency}"`);
  lines.push(`"Total Sessions","${data.summary.totalSessions}"`);
  lines.push(`"Average per Session","${data.summary.averagePerSession.toFixed(2)} ${data.summary.currency}"`);
  lines.push('');
  
  // Categories
  if (data.categories && data.categories.length > 0) {
    lines.push('"=== CATEGORIES ==="');
    lines.push('"Category","Amount","Percentage"');
    for (const cat of data.categories) {
      lines.push(`"${cat.name}","${cat.amount} ${data.summary.currency}","${cat.percentage.toFixed(1)}%"`);
    }
    lines.push('');
  }
  
  // Transactions
  if (data.transactions && data.transactions.length > 0) {
    lines.push('"=== TRANSACTIONS ==="');
    lines.push('"Date","Description","Amount","Category","Participants"');
    for (const tx of data.transactions) {
      const participants = tx.participants?.join(', ') || '';
      lines.push(`"${tx.date}","${tx.description}","${tx.amount} ${data.summary.currency}","${tx.category || ''}","${participants}"`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate HTML content for PDF export
 */
export function generateHTML(data: ExportData): string {
  const categoriesHTML = data.categories?.map(cat => `
    <tr>
      <td>${cat.name}</td>
      <td style="text-align: right;">${cat.amount.toLocaleString()} ${data.summary.currency}</td>
      <td style="text-align: right;">${cat.percentage.toFixed(1)}%</td>
    </tr>
  `).join('') || '';

  const transactionsHTML = data.transactions?.map(tx => `
    <tr>
      <td>${tx.date}</td>
      <td>${tx.description}</td>
      <td style="text-align: right;">${tx.amount.toLocaleString()} ${data.summary.currency}</td>
      <td>${tx.category || '-'}</td>
    </tr>
  `).join('') || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #fff; color: #1e293b; }
    h1 { color: #2ECC71; margin-bottom: 8px; font-size: 28px; }
    .subtitle { color: #64748b; margin-bottom: 32px; font-size: 14px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #334155; border-bottom: 2px solid #2ECC71; padding-bottom: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .summary-card { background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e2e8f0; }
    .summary-value { font-size: 24px; font-weight: 700; color: #2ECC71; }
    .summary-label { font-size: 12px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }
    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <h1>📊 ${data.title}</h1>
  <p class="subtitle">Generated on ${data.date}</p>
  
  <div class="section">
    <div class="section-title">💰 Summary</div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-value">${data.summary.totalSpent.toLocaleString()} ${data.summary.currency}</div>
        <div class="summary-label">Total Spent</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${data.summary.totalSessions}</div>
        <div class="summary-label">Total Sessions</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${data.summary.averagePerSession.toLocaleString()} ${data.summary.currency}</div>
        <div class="summary-label">Avg per Session</div>
      </div>
    </div>
  </div>
  
  ${data.categories && data.categories.length > 0 ? `
  <div class="section">
    <div class="section-title">🏷️ Categories</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align: right;">Amount</th>
          <th style="text-align: right;">Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${categoriesHTML}
      </tbody>
    </table>
  </div>
  ` : ''}
  
  ${data.transactions && data.transactions.length > 0 ? `
  <div class="section">
    <div class="section-title">📝 Transactions</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
          <th>Category</th>
        </tr>
      </thead>
      <tbody>
        ${transactionsHTML}
      </tbody>
    </table>
  </div>
  ` : ''}
  
  <div class="footer">
    Generated by Receipt Splitter App
  </div>
</body>
</html>
  `;
}

/**
 * Export data as CSV (via Share)
 */
export async function exportToCSV(data: ExportData): Promise<boolean> {
  try {
    const csv = generateCSV(data);
    
    await Share.share({
      message: csv,
      title: `${data.title}.csv`,
    });
    
    return true;
  } catch (error) {
    console.error('Export CSV error:', error);
    return false;
  }
}

/**
 * Export data as text report (for sharing)
 */
export async function exportAsText(data: ExportData): Promise<boolean> {
  try {
    let text = `📊 ${data.title}\n`;
    text += `📅 ${data.date}\n\n`;
    text += `💰 SUMMARY\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Total Spent: ${data.summary.totalSpent.toLocaleString()} ${data.summary.currency}\n`;
    text += `Total Sessions: ${data.summary.totalSessions}\n`;
    text += `Average: ${data.summary.averagePerSession.toFixed(0)} ${data.summary.currency}\n\n`;
    
    if (data.categories && data.categories.length > 0) {
      text += `🏷️ CATEGORIES\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      for (const cat of data.categories) {
        text += `• ${cat.name}: ${cat.amount.toLocaleString()} ${data.summary.currency} (${cat.percentage.toFixed(1)}%)\n`;
      }
      text += '\n';
    }
    
    text += `\n📱 Receipt Splitter App`;
    
    await Share.share({
      message: text,
      title: data.title,
    });
    
    return true;
  } catch (error) {
    console.error('Export text error:', error);
    return false;
  }
}

/**
 * Export as formatted PDF-like text (via Share)
 */
export async function exportToPDF(data: ExportData): Promise<boolean> {
  try {
    // Create a rich text version that looks like PDF
    let text = `═══════════════════════════════════════\n`;
    text += `       📊 ${data.title.toUpperCase()}\n`;
    text += `═══════════════════════════════════════\n\n`;
    text += `📅 Generated: ${data.date}\n\n`;
    
    text += `┌─────────────────────────────────────┐\n`;
    text += `│           💰 SUMMARY                │\n`;
    text += `├─────────────────────────────────────┤\n`;
    text += `│ Total Spent:    ${data.summary.totalSpent.toLocaleString().padStart(15)} ${data.summary.currency} │\n`;
    text += `│ Total Sessions: ${String(data.summary.totalSessions).padStart(15)}     │\n`;
    text += `│ Average:        ${data.summary.averagePerSession.toFixed(0).padStart(15)} ${data.summary.currency} │\n`;
    text += `└─────────────────────────────────────┘\n\n`;
    
    if (data.categories && data.categories.length > 0) {
      text += `┌─────────────────────────────────────┐\n`;
      text += `│        🏷️ CATEGORIES               │\n`;
      text += `├─────────────────────────────────────┤\n`;
      for (const cat of data.categories) {
        const name = cat.name.substring(0, 15).padEnd(15);
        const amount = cat.amount.toLocaleString().padStart(10);
        const pct = `${cat.percentage.toFixed(1)}%`.padStart(6);
        text += `│ ${name} ${amount} ${pct} │\n`;
      }
      text += `└─────────────────────────────────────┘\n\n`;
    }
    
    text += `═══════════════════════════════════════\n`;
    text += `     📱 Receipt Splitter App\n`;
    text += `═══════════════════════════════════════\n`;
    
    await Share.share({
      message: text,
      title: data.title,
    });
    
    return true;
  } catch (error) {
    console.error('Export PDF error:', error);
    return false;
  }
}
