import { DocumentResult, ExtractedRecord, ExtractedField } from '../types/document';

export function extractRecordsFromDocument(doc: DocumentResult | null): ExtractedRecord[] {
  if (!doc) return [];

  // If backend already returned records, use them directly
  if (doc.records && doc.records.length > 0) {
    return doc.records;
  }

  const records: ExtractedRecord[] = [];
  let recCounter = 1;

  // Regex pattern to extract Telugu / English key-value pairs
  const pattern = /(?:^|\s+)([A-Za-z\u0C00-\u0C7F\.\s\(\)\/]+?)\s*[:\-]\s*([^:\n]+?)(?=(?:\s+[A-Za-z\u0C00-\u0C7F\.\s\(\)\/]+?\s*[:\-])|$)/g;

  // 1. Parse from pages text
  if (doc.pages && doc.pages.length > 0) {
    for (const p of doc.pages) {
      const pageNo = p.page || 1;
      const text = p.text || '';
      if (!text.trim()) continue;

      const blocks = text.split(/\n\s*\n/);
      for (const block of blocks) {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) continue;

        const fields: ExtractedField[] = [];
        let firstNum: string | null = null;

        for (const line of lines) {
          // If first token is purely digits (often voter serial number)
          if (/^\d+$/.test(line) && fields.length === 0 && !firstNum) {
            firstNum = line;
            continue;
          }

          let matched = false;
          let m: RegExpExecArray | null;
          // Reset regex index
          pattern.lastIndex = 0;
          while ((m = pattern.exec(line)) !== null) {
            matched = true;
            const k = m[1].trim();
            const v = m[2].trim();
            if (k && k.length > 1) {
              fields.push({
                field_name: k,
                value: v || 'Not Available',
              });
            }
          }

          if (!matched) {
            if (line.includes(':') || line.includes('-')) {
              const sep = line.includes(':') ? ':' : '-';
              const parts = line.split(sep);
              const k = parts[0].trim();
              const v = parts.slice(1).join(sep).trim();
              if (k) {
                fields.push({
                  field_name: k,
                  value: v || 'Not Available',
                });
              }
            } else {
              // Check for Voter ID pattern like SJC1578129 or ABC1234567
              const voterIdMatch = line.match(/\b([A-Z]{2,4}\d{6,8})\b/);
              if (voterIdMatch) {
                fields.push({
                  field_name: 'ఓటరు ఐడి కార్డు నెం.',
                  value: voterIdMatch[1],
                });
              }
            }
          }
        }

        if (firstNum) {
          const hasSerial = fields.some((f) => f.field_name.includes('సం'));
          if (!hasSerial) {
            fields.unshift({
              field_name: 'గ్రా.పం.ఓ.జా.వ.సం.',
              value: firstNum,
            });
          }
        }

        if (fields.length > 0) {
          records.push({
            record_id: recCounter,
            page: pageNo,
            title: `రికార్డు ${recCounter} (పేజీ ${pageNo})`,
            fields,
          });
          recCounter++;
        }
      }
    }
  }

  // 2. If still no records from text, parse from table_rows_te
  if (records.length === 0 && doc.table_rows_te && doc.table_rows_te.length > 0) {
    for (const t of doc.table_rows_te) {
      const pageNo = t.Page || 1;
      const raw = t['Telugu / Original'] || '';
      if (raw && raw.includes(' | ')) {
        const cells = raw.split(' | ').map((c) => c.trim());
        const fields: ExtractedField[] = cells.map((cell, idx) => ({
          field_name: `ఫీల్డ్ ${idx + 1}`,
          value: cell || 'Not Available',
        }));

        records.push({
          record_id: recCounter,
          page: pageNo,
          title: `టేబుల్ రికార్డు ${recCounter} (పేజీ ${pageNo})`,
          fields,
        });
        recCounter++;
      }
    }
  }

  // 3. Fallback: Parse paragraphs if available
  if (records.length === 0 && doc.paragraphs && doc.paragraphs.length > 0) {
    for (const p of doc.paragraphs) {
      const pageNo = p.Page || 1;
      const text = p['Telugu paragraph'] || '';
      if (!text.trim()) continue;

      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const fields: ExtractedField[] = [];

      for (const line of lines) {
        if (line.includes(':') || line.includes('-')) {
          const sep = line.includes(':') ? ':' : '-';
          const parts = line.split(sep);
          const k = parts[0].trim();
          const v = parts.slice(1).join(sep).trim();
          if (k) {
            fields.push({
              field_name: k,
              value: v || 'Not Available',
            });
          }
        } else {
          fields.push({
            field_name: 'వివరాలు / పేరా',
            value: line,
          });
        }
      }

      if (fields.length > 0) {
        records.push({
          record_id: recCounter,
          page: pageNo,
          title: `పేరా వివరాలు (పేజీ ${pageNo})`,
          fields,
        });
        recCounter++;
      }
    }
  }

  return records;
}
